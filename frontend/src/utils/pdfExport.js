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

const SUBSCRIPT_DIGIT_MAP = { "\u2080":"0","\u2081":"1","\u2082":"2","\u2083":"3","\u2084":"4","\u2085":"5","\u2086":"6","\u2087":"7","\u2088":"8","\u2089":"9","\u208a":"+","\u208b":"-","\u208c":"=","\u208d":"(","\u208e":")" };
const SUPERSCRIPT_DIGIT_MAP = { "\u2070":"0","\u00b9":"1","\u00b2":"2","\u00b3":"3","\u2074":"4","\u2075":"5","\u2076":"6","\u2077":"7","\u2078":"8","\u2079":"9","\u207a":"+","\u207b":"-","\u207c":"=","\u207d":"(","\u207e":")","\u207f":"n" };
const SUBSCRIPT_LETTER_MAP = { "\u2090":"a","\u2091":"e","\u2095":"h","\u1d62":"i","\u2c7c":"j","\u2096":"k","\u2097":"l","\u2098":"m","\u2099":"n","\u2092":"o","\u209a":"p","\u1d63":"r","\u209b":"s","\u209c":"t","\u1d64":"u","\u1d65":"v","\u2093":"x" };
const GREEK_WORD_MAP = {
  "\u03b1":"alpha","\u03b2":"beta","\u03b3":"gamma","\u0393":"Gamma","\u03b4":"delta","\u0394":"Delta",
  "\u03b5":"epsilon","\u03b6":"zeta","\u03b7":"eta","\u03b8":"theta","\u0398":"Theta","\u03b9":"iota",
  "\u03ba":"kappa","\u03bb":"lambda","\u039b":"Lambda","\u03bc":"mu","\u03bd":"nu","\u03be":"xi",
  "\u03c0":"pi","\u03a0":"Pi","\u03c1":"rho","\u03c3":"sigma","\u03a3":"Sigma","\u03c4":"tau",
  "\u03c5":"upsilon","\u03c6":"phi","\u03a6":"Phi","\u03c7":"chi","\u03c8":"psi","\u03a8":"Psi",
  "\u03c9":"omega","\u03a9":"Omega",
};
const MATH_SYMBOL_WORD_MAP = {
  "\u2192":"->", "\u21d2":"=>", "\u2190":"<-", "\u21d0":"<=", "\u2194":"<->", "\u21d4":"<=>",
  "\u21cc":"<=>", "\u2260":"!=", "\u2265":">=", "\u2264":"<=", "\u2248":"~", "\u2261":"==",
  "\u221e":"infinity", "\u2202":"d", "\u2207":"grad", "\u221d":"proportional to",
  "\u2211":"sum", "\u222b":"integral", "\u220f":"product", "\u221a":"sqrt",
};

/** Replace a Unicode character outside jsPDF's supported font range with a
 * safe ASCII/Latin-1 equivalent, falling back to dropping it if unknown. */
function unicodeCharToSafeText(ch) {
  if (SUBSCRIPT_DIGIT_MAP[ch]) return SUBSCRIPT_DIGIT_MAP[ch];
  if (SUPERSCRIPT_DIGIT_MAP[ch]) return SUPERSCRIPT_DIGIT_MAP[ch];
  if (SUBSCRIPT_LETTER_MAP[ch]) return SUBSCRIPT_LETTER_MAP[ch];
  if (GREEK_WORD_MAP[ch]) return GREEK_WORD_MAP[ch];
  if (MATH_SYMBOL_WORD_MAP[ch]) return MATH_SYMBOL_WORD_MAP[ch];
  const code = ch.codePointAt(0);
  // ASCII and Latin-1 Supplement (the range jsPDF's base fonts actually
  // support) pass through untouched.
  if (code <= 0xff) return ch;
  // Anything else unrecognized (rare symbols, emoji, etc.) - drop rather
  // than let it render as a broken/wrong glyph.
  return "";
}

/** Normalize any character outside the PDF font's supported range across a
 * whole string (title, body text, captions - anywhere text ends up on the page). */
function sanitizeForPdfFont(text) {
  if (!text) return "";
  let out = "";
  for (const ch of text) {
    out += ch.codePointAt(0) > 0x7e ? unicodeCharToSafeText(ch) : ch;
  }
  return out;
}

function cleanSpecialCharacters(text) {
  if (!text) return "";
  const normalized = text
    .replace(/[\u201c\u201d\u201f\u2033\u2036]/g, '"') // Curly double quotes
    .replace(/[\u2018\u2019\u201b\u2032\u2035]/g, "'") // Curly single quotes / apostrophes
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u00ad]/g, "-") // Hyphens and dashes
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")        // Zero-width characters
    .replace(/\u2026/g, "...")                        // Ellipses
    .replace(/\u00a0/g, " ");                         // Non-breaking spaces
  // Anything left that the PDF's base fonts can't render (stray Unicode
  // subscripts/superscripts, Greek letters, arrows, math operators typed
  // directly into prose) gets converted to a safe plain-text equivalent.
  return sanitizeForPdfFont(normalized);
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

// ---------- LaTeX -> readable plain text ----------
//
// The essay backend emits real LaTeX ($$...$$ display blocks and $...$
// inline math, sometimes with \frac, \vec, \boldsymbol, \xrightarrow,
// subscripts, etc). jsPDF can't render LaTeX (and its base fonts can't
// render most non-Latin-1 Unicode either - see sanitizeForPdfFont above),
// so we convert math source into clean, ASCII-safe plain text instead
// (e.g. "\frac{d\vec{p}}{dt}=0" -> "(d(p))/(dt) = 0").
const GREEK_NAME_FIX = {
  // A handful of "var*" LaTeX variants that should map to the same plain
  // name as their base letter, rather than being left as "varepsilon" etc.
  varepsilon: "epsilon", varphi: "phi", varrho: "rho", vartheta: "theta", varsigma: "sigma",
};

/** Convert a snippet of LaTeX math source into readable plain text. */
function latexToPlainText(raw) {
  let t = raw;

  // Brace-sensitive commands can nest arbitrarily (e.g.
  // \boldsymbol{\vec{F}_{AB}} or \frac{d\vec{p}}{dt}), and each individual
  // regex below only matches a brace group with no braces inside it. So
  // resolve inside-out: repeat the whole set of passes until nothing
  // changes, which lets an inner \vec{p} get simplified first, which then
  // exposes the outer \frac{...}{...} on the next pass, and so on.
  for (let pass = 0; pass < 10; pass++) {
    const before = t;
    t = t.replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)");
    t = t.replace(/\\sqrt\{([^{}]*)\}/g, "sqrt($1)");
    // Reaction/limit-style arrows with an over/under label, e.g.
    // \xrightarrow{light} or \xrightarrow[catalyst]{light}.
    t = t.replace(/\\xrightarrow(?:\[[^[\]]*\])?\{([^{}]*)\}/g, " -> ($1) ");
    t = t.replace(/\\xleftarrow(?:\[[^[\]]*\])?\{([^{}]*)\}/g, " <- ($1) ");
    // Styling/decoration commands that just carry their argument through.
    t = t.replace(/\\(?:boldsymbol|mathbf|mathrm|mathit|mathcal|text|operatorname|vec|hat|bar|dot|ddot|overline|underline|widehat|widetilde)\s*\{([^{}]*)\}/g, "$1");
    // Subscript/superscript braces (e.g. F_{AB}) also block the regexes
    // above from seeing past them, so unwrap those braces here too and
    // let the loop re-check everything on the next pass.
    t = t.replace(/_\{([^{}]*)\}/g, "_$1");
    t = t.replace(/\^\{([^{}]*)\}/g, "^$1");
    // Generic fallback for any other single-argument brace command we
    // don't explicitly know about (e.g. \underbrace{x}) - drop the command
    // name and keep its argument, which is safer than leaving a stray
    // command name glued to whatever text follows.
    t = t.replace(/\\[a-zA-Z]+\{([^{}]*)\}/g, "$1");
    if (t === before) break;
  }

  // No-argument arrow variants.
  t = t.replace(/\\xrightarrow(?!\{|\[)/g, " -> ");
  t = t.replace(/\\xleftarrow(?!\{|\[)/g, " <- ");

  // Spacing / grouping commands.
  t = t.replace(/\\left|\\right|\\big[glmr]?|\\Big[glmr]?/g, "");
  t = t.replace(/\\quad|\\qquad/g, "   ");
  t = t.replace(/\\[,:;!]/g, " ");

  // Common math operators/symbols. Only Latin-1 characters (safely
  // renderable by jsPDF's base fonts) use their real symbol; everything
  // else uses a plain ASCII stand-in - see sanitizeForPdfFont's comment
  // for why arrows/Greek/operators can't just be dropped in as Unicode.
  const SYMBOLS = {
    "\\times": "\u00d7", "\\cdot": "\u00b7", "\\pm": "\u00b1", "\\mp": "-/+",
    "\\div": "\u00f7", "\\degree": "\u00b0", "\\circ": "\u00b0",
    "\\neq": "!=", "\\geq": ">=", "\\ge": ">=", "\\leq": "<=", "\\le": "<=",
    "\\approx": "~", "\\equiv": "==", "\\infty": "infinity",
    "\\partial": "d", "\\nabla": "grad ", "\\propto": "proportional to",
    "\\sum": "sum", "\\int": "integral", "\\prod": "product",
    "\\rightarrow": " -> ", "\\to": " -> ", "\\Rightarrow": " => ",
    "\\longrightarrow": " -> ", "\\Longrightarrow": " => ",
    "\\leftarrow": " <- ", "\\Leftarrow": " <= ",
    "\\longleftarrow": " <- ", "\\leftrightarrow": " <-> ",
    "\\Leftrightarrow": " <=> ", "\\rightleftharpoons": " <=> ",
    // \arrow isn't standard LaTeX, but the essay backend sometimes emits
    // it as a plain reaction arrow - treat it the same as \rightarrow.
    "\\arrow": " -> ",
  };
  for (const [cmd, sym] of Object.entries(SYMBOLS)) {
    t = t.split(cmd).join(sym);
  }

  // Any remaining \word (Greek letters, \sin, \lim, unrecognized commands,
  // etc.) - drop the backslash and keep the plain-text name, normalizing
  // the handful of "var*" Greek variants to their base name.
  t = t.replace(/\\([a-zA-Z]+)/g, (m, name) => GREEK_NAME_FIX[name] || name);

  // Cleanup: stray braces/backslashes and whitespace.
  t = t.replace(/[{}]/g, "");
  t = t.replace(/\\/g, "");
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

const FORMULA_PLACEHOLDER_RE = /^@@FORMULA_BLOCK_(\d+)@@$/;

/**
 * Convert every LaTeX math span in the raw markdown into plain text before
 * any line-based markdown parsing happens.
 *
 * Display equations ($$...$$) are matched with a DOTALL-style regex across
 * the whole string - NOT line-by-line - because the backend sometimes
 * emits the opening "$$" mid-sentence (e.g. "constant mass: $$\n...\n$$"),
 * which a line-start check would miss entirely and misparse. Each display
 * equation is pulled out, converted, and swapped for a standalone
 * placeholder line so the block-level parser can pick it up cleanly as its
 * own centered formula block.
 *
 * Inline math ($...$) is converted in place, directly into the surrounding
 * paragraph/list/table text, so no literal "$" or LaTeX commands ever
 * reach the page.
 */
function preprocessMath(markdown) {
  const displayFormulas = [];
  if (!markdown) return { text: "", displayFormulas };

  let text = markdown.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) => {
    const plain = latexToPlainText(expr);
    if (!plain) return "";
    const idx = displayFormulas.length;
    displayFormulas.push(plain);
    return `\n\n@@FORMULA_BLOCK_${idx}@@\n\n`;
  });

  // Whatever "$...$" pairs remain are inline math (display pairs were
  // already consumed above), so convert them to plain text in place.
  text = text.replace(/\$([^$\n]+?)\$/g, (_, expr) => {
    const plain = latexToPlainText(expr);
    if (!plain) return "";
    if (/\\(boldsymbol|mathbf)/.test(expr)) {
      return `**${plain}**`;
    }
    return plain;
  });

  return { text, displayFormulas };
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
function parseMarkdownBlocks(markdown, displayFormulas = []) {
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

    // Formula block placeholder, dropped in by preprocessMath() for every
    // $$...$$ display equation found anywhere in the raw markdown (see
    // preprocessMath for why this can't be a simple line-start check).
    const formulaMatch = line.trim().match(FORMULA_PLACEHOLDER_RE);
    if (formulaMatch) {
      flushParagraph();
      flushList();
      const formulaText = displayFormulas[Number(formulaMatch[1])];
      if (formulaText) blocks.push({ type: "formula", text: formulaText });
      i++;
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

/** Draw an already-converted (plain text) display formula, centered. */
function writeFormula(doc, cursor, rawText) {
  // rawText has already been through latexToPlainText() via preprocessMath(),
  // so this is just a defensive re-clean in case writeFormula is ever called
  // directly with raw LaTeX from elsewhere.
  const text = /[\\{}$]/.test(rawText) ? latexToPlainText(rawText) : rawText.trim();

  if (!text) return;

  const fontSize = 13;
  const lineHeight = fontSize + 8;
  cursor.ensureSpace(lineHeight + 16);
  cursor.y += 6;

  doc.setFont("courier", "bold");
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
  const { text, displayFormulas } = preprocessMath(markdown);
  const blocks = parseMarkdownBlocks(text, displayFormulas);
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