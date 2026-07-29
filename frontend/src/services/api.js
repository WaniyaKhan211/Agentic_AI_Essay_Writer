const API_URL = "http://127.0.0.1:8000";


export async function generateEssayStream(idea, onChunk) {

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

      for (const line of lines) {

        if (line.startsWith("data:")) {

       
          const raw = line.slice(5).replace(/^ /, "");

          if (raw.length > 0) {

            try {
              // Tokens are JSON-encoded server-side so embedded
              // newlines/whitespace survive intact.
              const token = JSON.parse(raw);
              onChunk(token);
            } catch (e) {
              console.error("Failed to parse SSE token:", raw, e);
            }

          }

        }

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