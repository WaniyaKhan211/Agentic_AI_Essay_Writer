const API_URL = "http://127.0.0.1:8000";


export async function generateEssayStream(idea, onChunk, onImages) {

  const response = await fetch(
    `${API_URL}/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idea: idea,
      }),
    }
  );


  const reader = response.body.getReader();

  const decoder = new TextDecoder();

  // Buffer across reads: network chunking doesn't respect SSE
  // event/line boundaries, so partial lines from one read() must be
  // carried over and completed by the next one.
  let buffer = "";

  const processBuffer = (isFinal) => {

    const normalized = buffer.replace(/\r\n/g, "\n");

    const events = normalized.split("\n\n");

    // Keep the last (possibly incomplete) piece buffered, unless this
    // is the final flush after the stream has ended.
    buffer = isFinal ? "" : events.pop();

    for (const rawEvent of events) {

      const lines = rawEvent.split("\n");

      // Default SSE event type is "message" when no explicit "event:" line
      // is present.
      let eventType = "message";
      let dataLine = null;

      for (const line of lines) {

        if (line.startsWith("event:")) {
          eventType = line.slice(6).replace(/^ /, "");
        }

        if (line.startsWith("data:")) {
          dataLine = line.slice(5).replace(/^ /, "");
        }

      }

      if (dataLine === null || dataLine.length === 0) {
        continue;
      }

      try {
        const parsed = JSON.parse(dataLine);

        if (eventType === "images") {
          onImages?.(parsed);
        } else {
          // Tokens are JSON-encoded server-side so embedded
          // newlines/whitespace survive intact.
          onChunk(parsed);
        }
      } catch (e) {
        console.error("Failed to parse SSE event:", eventType, dataLine, e);
      }

    }

  };

  while (true) {

    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, {
      stream: true
    });

    processBuffer(false);

  }

  // Flush any final event still sitting in the buffer (e.g. the last
  // event if the stream ended without a trailing blank-line separator).
  buffer += decoder.decode();
  processBuffer(true);

}