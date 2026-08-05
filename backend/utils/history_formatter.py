from langchain_core.messages import HumanMessage, AIMessage


def format_conversation_history(conversation_history, max_turns: int = 6) -> str:

    if not conversation_history:
        return ""

    recent = conversation_history[-max_turns:]

    lines = []

    for msg in recent:

        if isinstance(msg, HumanMessage):
            speaker = "User"
        elif isinstance(msg, AIMessage):
            speaker = "Assistant"
        else:
            continue

        # Assistant essays can be long — trim so the transcript stays
        # readable and doesn't blow up prompt size with full essay text.
        content = msg.content or ""
        if speaker == "Assistant" and len(content) > 400:
            content = content[:400] + "... [truncated]"

        lines.append(f"{speaker}: {content}")

    return "\n".join(lines)