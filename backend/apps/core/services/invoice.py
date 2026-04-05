"""
PDF invoice generator using fpdf2.
Returns raw PDF bytes.
"""
from decimal import Decimal

from fpdf import FPDF


def _safe(text: str) -> str:
    """Strip/replace characters outside Latin-1 so Helvetica doesn't crash."""
    return (text or "").\
        replace("\u2014", "-").replace("\u2013", "-").replace("\u2019", "'").\
        replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"').\
        encode("latin-1", errors="replace").decode("latin-1")


def generate_invoice_pdf(service_report, ors_settings=None, payment_url: str = "") -> bytes:
    ticket  = service_report.ticket
    store   = ticket.store
    if store is None and ticket.asset:
        store = ticket.asset.store
    org     = store.organization if store else None

    # ORS company info from settings (fallback to hardcoded defaults)
    company_name    = (ors_settings and ors_settings.company_name)  or "One Repair Solutions"
    company_address = (ors_settings and ors_settings.company_address) or ""
    company_phone   = (ors_settings and ors_settings.company_phone)   or ""
    company_email   = (ors_settings and ors_settings.company_email)   or ""

    # Payment terms label
    payment_terms_label = ""
    if org and hasattr(org, "payment_terms"):
        pt_map = {
            "DUE_ON_RECEIPT": "Due on Receipt",
            "NET_15": "Net 15 days",
            "NET_30": "Net 30 days",
            "NET_45": "Net 45 days",
        }
        payment_terms_label = pt_map.get(org.payment_terms, "")

    # Best asset name for the ticket
    first_ta = ticket.ticket_assets.select_related("asset").first()
    if first_ta:
        asset_name    = first_ta.asset.name if first_ta.asset else (first_ta.asset_description or "-")
        model_number  = first_ta.asset.model_number if first_ta.asset else "-"
        serial_number = first_ta.asset.serial_number if first_ta.asset else "-"
    elif ticket.asset:
        asset_name    = ticket.asset.name
        model_number  = ticket.asset.model_number or "-"
        serial_number = ticket.asset.serial_number or "-"
    else:
        asset_name = ticket.asset_description or "-"
        model_number = serial_number = "-"

    logo_url = (ors_settings and ors_settings.logo_url) or ""

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # ── Header ───────────────────────────────────────────────────────────────
    if logo_url:
        try:
            import urllib.request, tempfile, os
            ext = logo_url.split(".")[-1].split("?")[0].lower() or "png"
            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
                urllib.request.urlretrieve(logo_url, tmp.name)
                pdf.image(tmp.name, x=10, y=10, h=14)
                os.unlink(tmp.name)
            pdf.ln(16)
        except Exception:
            pass

    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 10, company_name, ln=True)

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 116, 139)
    if company_address:
        pdf.cell(0, 5, company_address, ln=True)
    contact_line = "  |  ".join(filter(None, [company_phone, company_email]))
    if contact_line:
        pdf.cell(0, 5, contact_line, ln=True)
    pdf.ln(4)

    pdf.set_draw_color(226, 232, 240)
    pdf.set_line_width(0.5)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)

    # Invoice meta
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 7, "SERVICE INVOICE", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 5, f"Invoice #: {ticket.ticket_number or str(ticket.id)[:8].upper()}", ln=True)
    pdf.cell(0, 5, f"Service Date: {ticket.completed_at.strftime('%B %d, %Y') if ticket.completed_at else service_report.created_at.strftime('%B %d, %Y')}", ln=True)
    if payment_terms_label:
        pdf.cell(0, 5, f"Payment Terms: {payment_terms_label}", ln=True)
    pdf.ln(6)

    # ── Two-column info ───────────────────────────────────────────────────────
    col_w = 90
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(col_w, 5, "BILLED TO", ln=False)
    pdf.cell(col_w, 5, "SERVICE LOCATION", ln=True)

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(15, 23, 42)
    store_addr = ""
    if store:
        parts = [store.address_line1, store.city, store.state, store.zip_code]
        store_addr = ", ".join(p for p in parts if p)
    rows = [
        (org.name if org else "-",       store.name if store else "-"),
        (store_addr or "-",              f"Asset: {asset_name}"),
        ("",                             f"Model: {model_number}  Serial: {serial_number}"),
    ]
    for left, right in rows:
        pdf.cell(col_w, 5, left, ln=False)
        pdf.cell(col_w, 5, right, ln=True)
    pdf.ln(8)

    # ── Ticket summary ────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(0, 5, "TICKET SUMMARY", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(15, 23, 42)
    tech = ticket.assigned_tech
    summary_rows = [
        ("Ticket #:", ticket.ticket_number or str(ticket.id)[:8].upper()),
        ("Technician:", tech.get_full_name() if tech else "-"),
    ]
    if service_report.formatted_report:
        summary_rows.append(("Summary:", _safe(service_report.formatted_report[:200])))
    if service_report.manager_on_site:
        summary_rows.append(("Authorized by:", _safe(service_report.manager_on_site)))
    for label, value in summary_rows:
        pdf.cell(50, 5, label)
        pdf.multi_cell(0, 5, value)
    pdf.ln(4)

    # ── Parts table ───────────────────────────────────────────────────────────
    inv_parts = list(service_report.parts_used.select_related("part").all())
    extra_parts = service_report.extra_line_items or []
    all_parts = (
        [{"name": pu.part.name if pu.part else "-", "sku": (pu.part.sku or "-") if pu.part else "-",
          "qty": pu.quantity, "unit_price": float(pu.unit_price_at_time), "line_total": float(pu.line_total)}
         for pu in inv_parts] +
        [{"name": p.get("name", "-"), "sku": p.get("sku", "-"),
          "qty": int(p.get("quantity", 1)), "unit_price": float(p.get("unit_price", 0)),
          "line_total": float(p.get("unit_price", 0)) * int(p.get("quantity", 1))}
         for p in extra_parts]
    )
    if all_parts:
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(255, 255, 255)
        pdf.set_fill_color(37, 99, 235)
        pdf.cell(80, 6, "Part", fill=True, ln=False)
        pdf.cell(25, 6, "SKU", fill=True, ln=False)
        pdf.cell(20, 6, "Qty", fill=True, ln=False)
        pdf.cell(30, 6, "Unit Price", fill=True, ln=False)
        pdf.cell(35, 6, "Line Total", fill=True, ln=True)

        pdf.set_font("Helvetica", "", 9)
        fill = False
        for p in all_parts:
            pdf.set_text_color(15, 23, 42)
            pdf.set_fill_color(241, 245, 249)
            pdf.cell(80, 6, _safe(p["name"]), fill=fill, ln=False)
            pdf.cell(25, 6, _safe(p["sku"]), fill=fill, ln=False)
            pdf.cell(20, 6, str(p["qty"]), fill=fill, ln=False)
            pdf.cell(30, 6, f"${p['unit_price']:.2f}", fill=fill, ln=False)
            pdf.cell(35, 6, f"${p['line_total']:.2f}", fill=fill, ln=True)
            fill = not fill
        pdf.ln(4)

    # ── Totals ────────────────────────────────────────────────────────────────
    col_label = 155
    col_val   = 35
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(col_label, 5, "Parts Subtotal:", ln=False, align="R")
    pdf.cell(col_val, 5, f"${service_report.parts_total:.2f}", ln=True, align="R")
    pdf.cell(col_label, 5, "Labor:", ln=False, align="R")
    pdf.cell(col_val, 5, f"${service_report.labor_cost:.2f}", ln=True, align="R")
    if service_report.tax_rate:
        pdf.cell(col_label, 5, f"Sales Tax ({service_report.tax_rate}%):", ln=False, align="R")
        pdf.cell(col_val, 5, f"${service_report.sales_tax:.2f}", ln=True, align="R")

    pdf.set_draw_color(203, 213, 225)
    pdf.line(130, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(2)

    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(col_label, 7, "TOTAL DUE:", ln=False, align="R")
    pdf.cell(col_val, 7, f"${service_report.grand_total:.2f}", ln=True, align="R")

    # ── Payment link ──────────────────────────────────────────────────────────
    if payment_url:
        pdf.ln(8)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(37, 99, 235)
        pdf.cell(0, 6, "Pay online:", ln=True, align="C")
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, payment_url, ln=True, align="C")

    pdf.ln(8)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 5, f"Thank you for choosing {company_name}.", ln=True, align="C")

    return pdf.output()
