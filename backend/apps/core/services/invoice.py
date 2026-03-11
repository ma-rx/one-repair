"""
PDF invoice generator using fpdf2.
Returns raw PDF bytes.
"""
from decimal import Decimal
from io import BytesIO

from fpdf import FPDF


def generate_invoice_pdf(service_report) -> bytes:
    ticket = service_report.ticket
    asset = ticket.asset
    store = asset.store
    org = store.organization

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # ── Header ───────────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(15, 23, 42)  # slate-900
    pdf.cell(0, 10, "One Repair Solutions", ln=True)

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100, 116, 139)  # slate-500
    pdf.cell(0, 5, "Field Service Management", ln=True)
    pdf.ln(4)

    # Divider
    pdf.set_draw_color(226, 232, 240)
    pdf.set_line_width(0.5)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)

    # Invoice meta
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 7, f"SERVICE INVOICE", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 5, f"Invoice #: SR-{str(service_report.id)[:8].upper()}", ln=True)
    pdf.cell(0, 5, f"Date: {service_report.created_at.strftime('%B %d, %Y')}", ln=True)
    pdf.ln(6)

    # ── Two-column info ───────────────────────────────────────────────────────
    col_w = 90
    y_start = pdf.get_y()

    # Left: Customer
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(col_w, 5, "BILLED TO", ln=False)
    pdf.cell(col_w, 5, "ASSET DETAILS", ln=True)

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(15, 23, 42)
    rows = [
        (org.name, asset.name),
        (store.name, f"Model: {asset.model_number or '—'}"),
        (store.address or "—", f"Serial: {asset.serial_number or '—'}"),
    ]
    for left, right in rows:
        pdf.cell(col_w, 5, left, ln=False)
        pdf.cell(col_w, 5, right, ln=True)

    pdf.ln(8)

    # ── Ticket info ───────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(0, 5, "TICKET SUMMARY", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(50, 5, "Ticket ID:")
    pdf.cell(0, 5, str(ticket.id), ln=True)
    pdf.cell(50, 5, "Symptom:")
    pdf.cell(0, 5, ticket.symptom_code.replace("_", " ").title(), ln=True)
    pdf.cell(50, 5, "Resolution:")
    pdf.cell(0, 5, service_report.resolution_code.replace("_", " ").title(), ln=True)
    tech = ticket.assigned_tech
    pdf.cell(50, 5, "Technician:")
    pdf.cell(0, 5, tech.get_full_name() if tech else "—", ln=True)
    pdf.ln(8)

    # ── Parts table ───────────────────────────────────────────────────────────
    parts = list(service_report.parts_used.select_related("part").all())

    if parts:
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(255, 255, 255)
        pdf.set_fill_color(37, 99, 235)  # blue-600
        pdf.cell(80, 6, "Part", fill=True, ln=False)
        pdf.cell(25, 6, "SKU", fill=True, ln=False)
        pdf.cell(20, 6, "Qty", fill=True, ln=False)
        pdf.cell(30, 6, "Unit Price", fill=True, ln=False)
        pdf.cell(35, 6, "Line Total", fill=True, ln=True)

        pdf.set_font("Helvetica", "", 9)
        fill = False
        for pu in parts:
            pdf.set_text_color(15, 23, 42)
            pdf.set_fill_color(241, 245, 249)  # slate-100
            pdf.cell(80, 6, pu.part.name, fill=fill, ln=False)
            pdf.cell(25, 6, pu.part.sku or "—", fill=fill, ln=False)
            pdf.cell(20, 6, str(pu.quantity), fill=fill, ln=False)
            pdf.cell(30, 6, f"${pu.unit_price_at_time:.2f}", fill=fill, ln=False)
            pdf.cell(35, 6, f"${pu.line_total:.2f}", fill=fill, ln=True)
            fill = not fill
        pdf.ln(4)

    # ── Totals ────────────────────────────────────────────────────────────────
    col_label = 155
    col_val = 35

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(col_label, 5, "Parts Subtotal:", ln=False, align="R")
    pdf.cell(col_val, 5, f"${service_report.parts_total:.2f}", ln=True, align="R")

    pdf.cell(col_label, 5, "Labor:", ln=False, align="R")
    pdf.cell(col_val, 5, f"${service_report.labor_cost:.2f}", ln=True, align="R")

    pdf.set_draw_color(203, 213, 225)
    pdf.line(130, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(2)

    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(col_label, 7, "TOTAL DUE:", ln=False, align="R")
    pdf.cell(col_val, 7, f"${service_report.grand_total:.2f}", ln=True, align="R")

    pdf.ln(10)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 5, "Thank you for choosing One Repair Solutions.", ln=True, align="C")

    return pdf.output()
