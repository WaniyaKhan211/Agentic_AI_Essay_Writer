export function groupMessagesWithVersions(rawMessages) {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return [];
  }

  const grouped = [];

  for (const msg of rawMessages) {
    const isUser = msg.sender === "user" || msg.role === "user";

    if (isUser) {
      grouped.push({
        ...msg,
        sender: "user",
        version: msg.version || 1,
      });
    } else {
      // AI message
      let existingAiMsgIndex = -1;

      if (msg.parent_id) {
        existingAiMsgIndex = grouped.findIndex(
          (m) => m.sender === "ai" && m.parent_id === msg.parent_id
        );
      } else {
        // Fallback: if parent_id is missing, group with the last AI message in grouped if available
        const lastIndex = grouped.length - 1;
        if (lastIndex >= 0 && grouped[lastIndex].sender === "ai") {
          existingAiMsgIndex = lastIndex;
        }
      }

      const versionObj = {
        id: msg.id,
        text: msg.text,
        version: msg.version || 1,
        images: msg.images || [],
      };

      if (existingAiMsgIndex !== -1) {
        const existing = grouped[existingAiMsgIndex];
        const existingVersions = existing.versions || [
          {
            id: existing.id,
            text: existing.text,
            version: existing.version || 1,
            images: existing.images || [],
          },
        ];

        // Deduplicate version entry by ID or version number
        const existingIdx = existingVersions.findIndex(
          (v) => v.id === msg.id || v.version === msg.version
        );

        let updatedVersions;
        if (existingIdx !== -1) {
          updatedVersions = [...existingVersions];
          updatedVersions[existingIdx] = {
            ...updatedVersions[existingIdx],
            text: msg.text,
            images: msg.images || updatedVersions[existingIdx].images || [],
          };
        } else {
          updatedVersions = [...existingVersions, versionObj];
        }

        // Sort versions ascending by version number
        updatedVersions.sort((a, b) => (a.version || 0) - (b.version || 0));

        const firstVersion = updatedVersions[0];

        grouped[existingAiMsgIndex] = {
          ...existing,
          id: firstVersion.id || msg.id,
          text: firstVersion.text,
          version: firstVersion.version,
          images: firstVersion.images || [],
          versions: updatedVersions,
        };
      } else {
        grouped.push({
          ...msg,
          sender: "ai",
          versions: [versionObj],
        });
      }
    }
  }

  return grouped;
}
