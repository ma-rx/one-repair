import logging

from django.conf import settings

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        import voyageai
        _client = voyageai.Client(api_key=settings.VOYAGE_API_KEY)
    return _client


def get_embedding(text: str, input_type: str = "document") -> list[float] | None:
    """
    Generate a Voyage AI embedding.
    Use input_type="document" when indexing records.
    Use input_type="query" when embedding a search query — Voyage optimises
    each vector for its role in retrieval, which meaningfully improves accuracy.
    """
    text = text.strip()
    if not text or not settings.VOYAGE_API_KEY:
        return None
    try:
        client = _get_client()
        result = client.embed([text], model="voyage-3", input_type=input_type)
        return result.embeddings[0]
    except Exception as e:
        logger.error("Voyage embedding failed (len=%d): %s", len(text), e)
        return None


def build_ticket_text(ticket) -> str:
    parts = []

    # Equipment identity
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
    if entry.symptom_description:
        parts.append(f"Symptom: {entry.symptom_description}")
    if entry.cause_summary:
        parts.append(f"Cause: {entry.cause_summary}")
    if entry.diagnostic_steps:
        for i, step in enumerate(entry.diagnostic_steps, 1):
            action      = step.get("action", "")
            finding     = step.get("finding", "")
            next_action = step.get("next_action", "")
            line = f"Step {i}: {action}"
            if finding:
                line += f" — If: {finding}"
            if next_action:
                line += f" → {next_action}"
            parts.append(line)
    if entry.parts_commonly_used:
        parts.append(f"Parts: {entry.parts_commonly_used}")
    if entry.pro_tips:
        parts.append(f"Tips: {entry.pro_tips}")

    return "\n".join(parts)


def embed_ticket(ticket) -> bool:
    text = build_ticket_text(ticket)
    if not text:
        return False
    vec = get_embedding(text, input_type="document")
    if vec is None:
        return False
    ticket.embedding = vec
    ticket.save(update_fields=["embedding"])
    return True


CHUNK_SIZE    = 3000
CHUNK_OVERLAP = 300


def chunk_text(text: str) -> list[str]:
    chunks = []
    start  = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = end - CHUNK_OVERLAP
    return chunks


def embed_repair_document(doc) -> int:
    """Chunk a RepairDocument and embed each chunk. Returns number of chunks embedded."""
    from ..models import RepairDocumentChunk

    doc.chunks.all().delete()

    chunks   = chunk_text(doc.content)
    embedded = 0
    for i, chunk in enumerate(chunks):
        vec = get_embedding(chunk, input_type="document")
        RepairDocumentChunk.objects.create(
            document=doc,
            chunk_index=i,
            content=chunk,
            embedding=vec,
        )
        if vec:
            embedded += 1

    # Store first chunk's embedding on the document as the is_embedded sentinel
    if embedded > 0:
        first = doc.chunks.filter(embedding__isnull=False).order_by("chunk_index").first()
        if first:
            doc.embedding = first.embedding
            doc.save(update_fields=["embedding"])

    return embedded


def embed_knowledge_entry(entry) -> bool:
    text = build_knowledge_text(entry)
    if not text:
        return False
    vec = get_embedding(text, input_type="document")
    if vec is None:
        return False
    entry.embedding = vec
    entry.save(update_fields=["embedding"])
    return True
