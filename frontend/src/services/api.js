const API_URL = "http://127.0.0.1:8000";


export async function generateEssayStream(idea, callbacks, signal, conversationId) {

  const {
    onChunk,
    onImages,
    onStatus,
    onTitle,
    onError,
  } = callbacks;

  const response = await fetch(
    `${API_URL}/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idea: idea,
        conversation_id: conversationId != null ? String(conversationId) : null,
      }),
      signal,
    }
  );


  const reader = response.body.getReader();

  const decoder = new TextDecoder();

  let buffer = "";

  const processBuffer = (isFinal) => {

    const normalized = buffer.replace(/\r\n/g, "\n");

    const events = normalized.split("\n\n");

    buffer = isFinal ? "" : events.pop();

    for (const rawEvent of events) {

      const lines = rawEvent.split("\n");

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
        } else if (eventType === "status") {
          onStatus?.(parsed);
        } else if (eventType === "title") {
          onTitle?.(parsed);
        } else if (eventType === "error") {
          onError?.(parsed);
        } else {
          
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

  buffer += decoder.decode();
  processBuffer(true);

}