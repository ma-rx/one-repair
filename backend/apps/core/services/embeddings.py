from django.conf import settings

_client = None


def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


def get_embedding(text: str) -> list[float] | None:
    text = text.strip()
    if not text or not settings.OPENAI_API_KEY:
        return None
    try:
        client = _get_client()
        response = client.embeddings.create(
            input=text,
            model="text-embedding-3-small",
        )
        return response.data[0].embedding
    except Exception:
        return None


def build_ticket_text(ticket) -> str:
    parts = []

    # Equipment
    if ticket.asset_description:
        parts.append(f"Equipment: {ticket.asset_description}")
    if ticket.asset and ticket.asset.equipment_model:
        m = ticket.asset.equipment_model
        parts.append(f"Model: {m.make} {m.model_number} {m.model_name}".strip())

    # Symptom description
    if ticket.description:
        parts.append(f"Problem: {ticket.description}")

    # Service report content
    for report in ticket.service_reports.prefetch_related("parts_used__part").all():
        if report.tech_notes:
            parts.append(f"Tech Notes: {report.tech_notes}")
        if report.formatted_report and report.formatted_report != report.tech_notes:
            parts.append(f"Report: {report.formatted_report}")
        part_names = [pu.part.name for pu in report.parts_used.all() if pu.part]
        if part_names:
            parts.append(f"Parts Used: {', '.join(part_names)}")

    return "\n".join(parts)


def build_knowledge_text(entry) -> str:
    parts = []

    if entry.make or entry.model_number:
        parts.append(f"Equipment: {entry.make} {entry.model_number}".strip())
    if entry.asset_category:
        parts.append(f"Category: {entry.asset_category}")
    if entry.cause_summary:
        parts.append(f"Cause: {entry.cause_summary}")
    if entry.procedure:
        parts.append(f"Procedure: {entry.procedure}")
    if entry.parts_commonly_used:
        parts.append(f"Parts: {entry.parts_commonly_used}")
    if entry.pro_tips:
        parts.append(f"Tips: {entry.pro_tips}")

    return "\n".join(parts)


def embed_ticket(ticket) -> bool:
    text = build_ticket_text(ticket)
    if not text:
        return False
    vec = get_embedding(text)
    if vec is None:
        return False
    ticket.embedding = vec
    ticket.save(update_fields=["embedding"])
    return True


def embed_knowledge_entry(entry) -> bool:
    text = build_knowledge_text(entry)
    if not text:
        return False
    vec = get_embedding(text)
    if vec is None:
        return False
    entry.embedding = vec
    entry.save(update_fields=["embedding"])
    return True
