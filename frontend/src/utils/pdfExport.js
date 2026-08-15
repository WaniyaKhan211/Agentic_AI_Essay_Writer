// pdfExport.js
//
// Turns an AI essay message (markdown text + generated images) into a
// clean, paginated PDF using jsPDF.
//
// Why not just html2canvas the bubble? Screenshotting the chat bubble
// produces a blurry, non-selectable, oddly-cropped PDF and images loaded
// from a remote URL (Supabase storage) often get clipped mid-page.
// Instead we:
//   1. Parse the markdown ourselves (headings, bold/italic, lists) and
//      lay the text out with real word-wrapping + pagination.
//   2. Fetch each image, decode its real pixel size, scale it to fit the
//      page width/height, and always start a new page BEFORE an image if
//      it can't fit fully on the current one (so it never gets cut in half).
//
// Install once in /frontend:  npm install jspdf

import { jsPDF } from "jspdf";

// ---------- Page geometry (points) ----------
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Images are shown at a modest size, not blown up to the full page -
// roughly postcard-sized on the page, never more than ~1/3 of a page tall.
const IMAGE_MAX_WIDTH = CONTENT_WIDTH * 0.6;
const IMAGE_MAX_HEIGHT = 230;

// Visible whitespace between the bottom of an image and the top of its
// caption text (see the note in writeImages() for why this can't just be
// added to the baseline y directly).
const IMAGE_CAPTION_GAP = 12;

// ---------- Small helpers ----------

function cleanSpecialCharacters(text) {
  if (!text) return "";
  return text
    .replace(/[\u201c\u201d\u201f\u2033\u2036]/g, '"') // Curly double quotes
    .replace(/[\u2018\u2019\u201b\u2032\u2035]/g, "'") // Curly single quotes / apostrophes
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u00ad]/g, "-") // Hyphens and dashes
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")        // Zero-width characters
    .replace(/\u2026/g, "...")                        // Ellipses
    .replace(/\u00a0/g, " ");                         // Non-breaking spaces
}

function groupLineIntoRuns(line) {
  if (!line || line.length === 0) return [];
  const runs = [];
  let currentRun = null;
  for (const w of line) {
    const isSameStyle = currentRun && 
                        currentRun.bold === !!w.bold && 
                        currentRun.italic === !!w.italic && 
                        currentRun.code === !!w.code;
    if (isSameStyle) {
      currentRun.text += (currentRun.trailingSpace ? " " : "") + w.text;
      currentRun.trailingSpace = w.trailingSpace;
    } else {
      if (currentRun) {
        runs.push(currentRun);
      }
      currentRun = {
        text: w.text,
        bold: !!w.bold,
        italic: !!w.italic,
        code: !!w.code,
        trailingSpace: w.trailingSpace
      };
    }
  }
  if (currentRun) {
    runs.push(currentRun);
  }
  return runs;
}

function sanitizeFileName(name) {
  return (name || "essay")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80) || "essay";
}

/** Normalize a line of text for "is this basically the title again?" comparisons. */
function normalizeForCompare(s) {
  return (s || "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/[*_`]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Essay markdown sometimes repeats the title as its own first line(s)
 * (occasionally even twice, back to back) before the real body starts.
 * Since we already render the title once as the PDF's H1, strip any
 * leading lines that just duplicate it so it doesn't print twice.
 */
function stripLeadingDuplicateTitle(markdown, title) {
  const targetNorm = normalizeForCompare(title);
  if (!targetNorm) return markdown;

  const lines = (markdown || "").replace(/\r\n/g, "\n").split("\n");
  let idx = 0;
  while (idx < lines.length) {
    const trimmed = lines[idx].trim();
    if (!trimmed) {
      idx++;
      continue;
    }
    if (normalizeForCompare(trimmed) === targetNorm) {
      idx++;
      continue;
    }
    break;
  }
  return lines.slice(idx).join("\n");
}

/** Strip inline image markdown and turn [label](url) links into plain "label" text. */
function stripUnsupportedMarkdown(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // ![alt](url) - images handled separately
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1") // [label](url) -> label
    .replace(/^-{3,}\s*$/gm, ""); // horizontal rules
}

/** Split a markdown string into block-level tokens. */
function parseMarkdownBlocks(markdown) {
  const lines = stripUnsupportedMarkdown(markdown).replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraphBuffer = [];
  let listBuffer = null;

  const flushParagraph = () => {
    if (paragraphBuffer.length) {
      blocks.push({ type: "paragraph", text: paragraphBuffer.join(" ").trim() });
      paragraphBuffer = [];
    }
  };
  const flushList = () => {
    if (listBuffer && listBuffer.items.length) blocks.push(listBuffer);
    listBuffer = null;
  };

  const isTableSeparatorRow = (l) =>
    /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);

  const splitTableRow = (l) => {
    let t = l.trim();
    if (t.startsWith("|")) t = t.slice(1);
    if (t.endsWith("|")) t = t.slice(0, -1);
    return t.split("|").map((c) => c.trim());
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();

    if (!line.trim()) {
      flushParagraph();
      flushList();
      i++;
      continue;
    }

    // Formula block: $$ ... $$ either on one line or spanning several.
    if (line.trim().startsWith("$$")) {
      flushParagraph();
      flushList();
      let formulaLines = [line.trim().replace(/^\$\$/, "")];
      let closed = formulaLines[0].endsWith("$$");
      if (closed) formulaLines[0] = formulaLines[0].replace(/\$\$$/, "");
      i++;
      while (!closed && i < lines.length) {
        const l = lines[i];
        if (l.trim().endsWith("$$")) {
          formulaLines.push(l.trim().replace(/\$\$$/, ""));
          closed = true;
          i++;
          break;
        }
        formulaLines.push(l.trim());
        i++;
      }
      const formulaText = formulaLines.join(" ").trim();
      if (formulaText) blocks.push({ type: "formula", text: formulaText });
      continue;
    }

    // Markdown table: a row containing "|" immediately followed by a
    // "|---|---|" separator row.
    if (line.includes("|") && i + 1 < lines.length && isTableSeparatorRow(lines[i + 1])) {
      flushParagraph();
      flushList();
      const header = splitTableRow(line);
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      i++;
      continue;
    }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushParagraph();
      const ordered = !!ol;
      const itemText = (ul ? ul[1] : ol[1]).trim();
      if (!listBuffer || listBuffer.ordered !== ordered) {
        flushList();
        listBuffer = { type: "list", ordered, items: [] };
      }
      listBuffer.items.push(itemText);
      i++;
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push({ type: "quote", text: quote[1].trim() });
      i++;
      continue;
    }

    flushList();
    paragraphBuffer.push(line.trim());
    i++;
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** Turn "**bold** *italic* `code` plain" into styled runs. */
function parseInlineRuns(text) {
  const runs = [];
  const regex = /(\*\*\*([^*]+)\*\*\*)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ text: text.slice(lastIndex, match.index) });
    }
    if (match[2] !== undefined) runs.push({ text: match[2], bold: true, italic: true });
    else if (match[4] !== undefined) runs.push({ text: match[4], bold: true });
    else if (match[6] !== undefined) runs.push({ text: match[6], italic: true });
    else if (match[8] !== undefined) runs.push({ text: match[8], code: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) runs.push({ text: text.slice(lastIndex) });
  return runs.length ? runs : [{ text }];
}

/** Break styled runs into individual "words" (with trailing space) carrying their style. */
function runsToWords(runs) {
  const words = [];
  for (const run of runs) {
    const parts = run.text.split(/(\s+)/).filter((p) => p.length > 0);
    for (const part of parts) {
      if (/^\s+$/.test(part)) {
        if (words.length) words[words.length - 1].trailingSpace = true;
        continue;
      }
      words.push({ text: part, bold: !!run.bold, italic: !!run.italic, code: !!run.code, trailingSpace: false });
    }
  }
  return words;
}

/**
 * Safety net: if a single "word" (no internal spaces - a stray long token,
 * URL, or unbroken symbol run) is wider than the available line width on
 * its own, force-break it into smaller chunks so it can never run past the
 * page margin. Without this, one long unbreakable token would overflow the
 * page and visually crash into whatever comes next.
 */
function forceBreakOversizedWords(doc, words, maxWidth, fontSize) {
  const result = [];
  for (const word of words) {
    setFontForWord(doc, word, fontSize);
    if (doc.getTextWidth(word.text) <= maxWidth) {
      result.push(word);
      continue;
    }
    let chunk = "";
    for (const ch of word.text) {
      const candidate = chunk + ch;
      setFontForWord(doc, word, fontSize);
      if (doc.getTextWidth(candidate) > maxWidth && chunk) {
        result.push({ ...word, text: chunk, trailingSpace: false });
        chunk = ch;
      } else {
        chunk = candidate;
      }
    }
    if (chunk) result.push({ ...word, text: chunk, trailingSpace: word.trailingSpace });
  }
  return result;
}

function setFontForWord(doc, word, baseSize) {
  let style = "normal";
  if (word.bold && word.italic) style = "bolditalic";
  else if (word.bold) style = "bold";
  else if (word.italic) style = "italic";
  doc.setFont(word.code ? "courier" : "helvetica", style);
  doc.setFontSize(word.code ? baseSize - 1 : baseSize);
}

/** A tiny cursor object that knows how to page-break as content is written. */
function makeCursor(doc) {
  return {
    y: MARGIN,
    ensureSpace(height) {
      if (this.y + height > PAGE_HEIGHT - MARGIN) {
        doc.addPage();
        this.y = MARGIN;
      }
    },
    newPage() {
      doc.addPage();
      this.y = MARGIN;
    },
  };
}

function wrapStyledWords(doc, words, maxWidth, fontSize) {
  const spaceWidth = (() => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    return doc.getTextWidth(" ");
  })();

  const safeWords = forceBreakOversizedWords(doc, words, maxWidth, fontSize);
  const lines = [];
  let currentLine = [];
  let lineWidth = 0;

  for (const word of safeWords) {
    setFontForWord(doc, word, fontSize);
    const wWidth = doc.getTextWidth(word.text) + (word.trailingSpace ? spaceWidth : 0);

    if (lineWidth + wWidth > maxWidth && currentLine.length) {
      lines.push(currentLine);
      currentLine = [];
      lineWidth = 0;
    }
    currentLine.push(word);
    lineWidth += wWidth;
  }
  if (currentLine.length) {
    lines.push(currentLine);
  }
  return lines;
}

/** Word-wrap + draw a run of styled words, honoring page breaks per line. */
function writeStyledLines(doc, cursor, words, { x, maxWidth, fontSize, lineHeight, color = "#1f2023" }) {
  doc.setTextColor(color);
  const lines = wrapStyledWords(doc, words, maxWidth, fontSize);

  const spaceWidth = (() => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    return doc.getTextWidth(" ");
  })();

  for (const line of lines) {
    cursor.ensureSpace(lineHeight);
    let cx = x;
    const runs = groupLineIntoRuns(line);
    for (const r of runs) {
      setFontForWord(doc, r, fontSize);
      doc.text(r.text, cx, cursor.y);
      cx += doc.getTextWidth(r.text) + (r.trailingSpace ? spaceWidth : 0);
    }
    cursor.y += lineHeight;
  }
}

function writeParagraph(doc, cursor, text, opts = {}) {
  const { fontSize = 11, lineHeight = 16, indent = 0, spacingAfter = 10 } = opts;
  const words = runsToWords(parseInlineRuns(text));
  writeStyledLines(doc, cursor, words, {
    x: MARGIN + indent,
    maxWidth: CONTENT_WIDTH - indent,
    fontSize,
    lineHeight,
  });
  cursor.y += spacingAfter;
}

function writeHeading(doc, cursor, text, level) {
  const sizes = { 1: 20, 2: 17, 3: 14, 4: 12, 5: 12, 6: 12 };
  const fontSize = sizes[level] || 12;
  cursor.ensureSpace(fontSize + 14);
  cursor.y += level === 1 ? 6 : 4;
  const words = runsToWords([{ text, bold: true }]);
  writeStyledLines(doc, cursor, words, {
    x: MARGIN,
    maxWidth: CONTENT_WIDTH,
    fontSize,
    lineHeight: fontSize + 6,
  });
  cursor.y += 12;
}

function writeList(doc, cursor, block) {
  const fontSize = 11;
  const lineHeight = 16;
  const bulletIndent = 18;

  block.items.forEach((item, idx) => {
    const marker = block.ordered ? `${idx + 1}.` : "\u2022";
    cursor.ensureSpace(lineHeight);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor("#1f2023");
    doc.text(marker, MARGIN, cursor.y);

    const words = runsToWords(parseInlineRuns(item));
    writeStyledLines(doc, cursor, words, {
      x: MARGIN + bulletIndent,
      maxWidth: CONTENT_WIDTH - bulletIndent,
      fontSize,
      lineHeight,
    });
  });
  cursor.y += 8;
}

function writeQuote(doc, cursor, text) {
  const fontSize = 11;
  const lineHeight = 16;
  const indent = 16;
  const startY = cursor.y;

  writeParagraph(doc, cursor, text, { fontSize, lineHeight, indent, spacingAfter: 10 });

  doc.setDrawColor("#c9a7e0");
  doc.setLineWidth(2);
  doc.line(MARGIN + 2, startY - fontSize, MARGIN + 2, cursor.y - 6);
}

/** Turn simple LaTeX ($$...$$) into readable plain text and draw it centered. */
function writeFormula(doc, cursor, rawText) {
  const text = rawText
    .replace(/\\boldsymbol\{([^}]*)\}/g, "$1")
    .replace(/\\times/g, "\u00d7")
    .replace(/\\cdot/g, "\u00b7")
    .replace(/\\quad/g, "   ")
    .replace(/\\[,;]/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\\/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return;

  const fontSize = 13;
  const lineHeight = fontSize + 8;
  cursor.ensureSpace(lineHeight + 16);
  cursor.y += 6;

  doc.setFont("courier", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor("#1f2023");
  const wrapped = doc.splitTextToSize(text, CONTENT_WIDTH * 0.85);
  for (const lineText of wrapped) {
    const textWidth = doc.getTextWidth(lineText);
    doc.text(lineText, MARGIN + (CONTENT_WIDTH - textWidth) / 2, cursor.y);
    cursor.y += lineHeight;
  }
  cursor.y += 10;
}

/** Render a small markdown table as an actual bordered grid (not raw pipe text). */
function writeTable(doc, cursor, header, rows) {
  const fontSize = 10;
  const cellPaddingX = 6;
  const cellPaddingY = 6;
  const lineHeight = fontSize + 3;
  const colCount = header.length;
  const colWidth = CONTENT_WIDTH / colCount;

  const measureRow = (cells, bold) => {
    const wrappedCells = cells.map((cell) => {
      const cleaned = cleanSpecialCharacters(cell || "");
      const runs = parseInlineRuns(cleaned);
      if (bold) {
        runs.forEach((r) => (r.bold = true));
      }
      const words = runsToWords(runs);
      return wrapStyledWords(doc, words, colWidth - cellPaddingX * 2, fontSize);
    });
    const rowHeight =
      Math.max(1, ...wrappedCells.map((w) => w.length)) * lineHeight + cellPaddingY * 2;
    return { wrappedCells, rowHeight };
  };

  const drawRow = (wrappedCells, rowHeight, { bold = false, fill = null } = {}) => {
    cursor.ensureSpace(rowHeight);
    const rowTop = cursor.y;

    if (fill) {
      doc.setFillColor(fill);
      doc.rect(MARGIN, rowTop, CONTENT_WIDTH, rowHeight, "F");
    }

    doc.setDrawColor("#e5e7eb");
    doc.setLineWidth(0.75);
    doc.setTextColor("#1f2023");

    const spaceWidth = (() => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
      return doc.getTextWidth(" ");
    })();

    wrappedCells.forEach((lines, colIdx) => {
      const cellX = MARGIN + colIdx * colWidth;
      let textY = rowTop + cellPaddingY + fontSize * 0.8;

      for (const line of lines) {
        let cx = cellX + cellPaddingX;
        const runs = groupLineIntoRuns(line);
        for (const r of runs) {
          setFontForWord(doc, r, fontSize);
          doc.text(r.text, cx, textY);
          cx += doc.getTextWidth(r.text) + (r.trailingSpace ? spaceWidth : 0);
        }
        textY += lineHeight;
      }
      doc.rect(cellX, rowTop, colWidth, rowHeight); // cell border
    });

    cursor.y = rowTop + rowHeight;
  };

  cursor.y += 4;
  const headerMeasure = measureRow(header, true);
  // Keep header with at least its first data row when deciding page breaks.
  cursor.ensureSpace(headerMeasure.rowHeight + lineHeight);
  drawRow(headerMeasure.wrappedCells, headerMeasure.rowHeight, { bold: true, fill: "#f3e8fb" });

  rows.forEach((row) => {
    const cells = header.map((_, idx) => row[idx] ?? "");
    const { wrappedCells, rowHeight } = measureRow(cells, false);
    drawRow(wrappedCells, rowHeight);
  });

  cursor.y += 14;
}

function writeMarkdownBody(doc, cursor, markdown) {
  const blocks = parseMarkdownBlocks(markdown);
  for (const block of blocks) {
    if (block.type === "heading") writeHeading(doc, cursor, block.text, block.level);
    else if (block.type === "list") writeList(doc, cursor, block);
    else if (block.type === "quote") writeQuote(doc, cursor, block.text);
    else if (block.type === "formula") writeFormula(doc, cursor, block.text);
    else if (block.type === "table") writeTable(doc, cursor, block.header, block.rows);
    else writeParagraph(doc, cursor, block.text);
  }
}

/** Fetch a remote image and resolve its base64 data + true pixel dimensions. */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    fetch(url, { mode: "cors" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(
        (blob) =>
          new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onloadend = () => res({ dataUrl: reader.result, mime: blob.type });
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          })
      )
      .then(({ dataUrl, mime }) => {
        const img = new Image();
        img.onload = () => {
          const format = mime.includes("png") ? "PNG" : mime.includes("webp") ? "WEBP" : "JPEG";
          resolve({ dataUrl, format, width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => reject(new Error("Could not decode image"));
        img.src = dataUrl;
      })
      .catch(reject);
  });
}

async function writeImages(doc, cursor, images) {
  if (!images || images.length === 0) return;

  writeHeading(doc, cursor, "Illustrations", 2);
  cursor.y += 10; // extra breathing room between the heading and the first image

  const loaded = await Promise.allSettled(images.map((img) => loadImage(img.image)));

  loaded.forEach((result, idx) => {
    const meta = images[idx];

    if (result.status !== "fulfilled") {
      // Don't let one broken image ruin the whole PDF - note it and move on.
      cursor.ensureSpace(20);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor("#9a3b3b");
      doc.text(`[Image "${meta?.title || `Figure ${idx + 1}`}" could not be loaded]`, MARGIN, cursor.y);
      cursor.y += 20;
      return;
    }

    const { dataUrl, format, width, height } = result.value;

    // Scale to fit within a modest box (both width AND height capped) while
    // preserving aspect ratio - never upscale past the source image either.
    const scale = Math.min(IMAGE_MAX_WIDTH / width, IMAGE_MAX_HEIGHT / height, 1);
    const drawWidth = width * scale;
    const drawHeight = height * scale;

    // Pre-measure the caption so we know the block's real height before
    // deciding whether it fits on the current page.
    const captionEntries = [];
    if (meta?.title) captionEntries.push({ text: meta.title, bold: true, size: 11 });
    if (meta?.caption) captionEntries.push({ text: meta.caption, bold: false, size: 10 });

    const measuredCaptions = captionEntries.map((entry) => {
      const cleaned = cleanSpecialCharacters(entry.text);
      const runs = parseInlineRuns(cleaned);
      if (entry.bold) {
        runs.forEach((r) => (r.bold = true));
      }
      const words = runsToWords(runs);
      const wrapped = wrapStyledWords(doc, words, CONTENT_WIDTH, entry.size);
      const lineHeight = entry.size + 4;
      return { ...entry, wrapped, lineHeight, height: wrapped.length * lineHeight };
    });
    const captionBlockHeight = measuredCaptions.reduce((sum, c) => sum + c.height, 0);

    // jsPDF draws text at its BASELINE, not its top.
    const firstCaptionAscent = measuredCaptions.length ? measuredCaptions[0].size * 0.8 : 0;
    const totalBlockHeight =
      drawHeight + IMAGE_CAPTION_GAP + firstCaptionAscent + captionBlockHeight + 14;

    // If the whole image+caption block doesn't fit in what's left on this
    // page, move to a fresh page BEFORE drawing anything from this block.
    if (cursor.y + totalBlockHeight > PAGE_HEIGHT - MARGIN) {
      cursor.newPage();
    }

    const x = MARGIN + (CONTENT_WIDTH - drawWidth) / 2;
    doc.addImage(dataUrl, format, x, cursor.y, drawWidth, drawHeight, undefined, "FAST");
    
    cursor.y += drawHeight + IMAGE_CAPTION_GAP + firstCaptionAscent;

    for (const c of measuredCaptions) {
      doc.setTextColor(c.bold ? "#1f2023" : "#6b7280");
      const spaceWidth = (() => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(c.size);
        return doc.getTextWidth(" ");
      })();

      for (const line of c.wrapped) {
        let cx = MARGIN;
        const runs = groupLineIntoRuns(line);
        for (const r of runs) {
          setFontForWord(doc, r, c.size);
          doc.text(r.text, cx, cursor.y);
          cx += doc.getTextWidth(r.text) + (r.trailingSpace ? spaceWidth : 0);
        }
        cursor.y += c.lineHeight;
      }
    }
    cursor.y += 14;
  });
}

function addPageNumbers(doc) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor("#9ca3af");
    doc.text(`${i} / ${total}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 24, { align: "center" });
  }
}

/**
 * Export an essay message to a downloadable PDF.
 * @param {Object} opts
 * @param {string} opts.title - Essay title (used as the H1 + filename).
 * @param {string} opts.markdown - The essay body (markdown).
 * @param {Array<{image:string,title?:string,caption?:string}>} opts.images
 */
export async function exportEssayToPDF({ title, markdown, images = [] }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const cursor = makeCursor(doc);

  const resolvedTitle = cleanSpecialCharacters(title?.trim() || "Essay");
  writeHeading(doc, cursor, resolvedTitle, 1);
  doc.setDrawColor("#e5e7eb");
  doc.setLineWidth(1);
  doc.line(MARGIN, cursor.y - 4, PAGE_WIDTH - MARGIN, cursor.y - 4);
  cursor.y += 20;

  const cleanedMarkdown = cleanSpecialCharacters(markdown || "");
  const body = stripLeadingDuplicateTitle(cleanedMarkdown, resolvedTitle);
  writeMarkdownBody(doc, cursor, body);

  const cleanedImages = images.map((img) => ({
    ...img,
    title: cleanSpecialCharacters(img.title),
    caption: cleanSpecialCharacters(img.caption),
  }));
  await writeImages(doc, cursor, cleanedImages);

  addPageNumbers(doc);
  doc.save(`${sanitizeFileName(resolvedTitle)}.pdf`);
}
