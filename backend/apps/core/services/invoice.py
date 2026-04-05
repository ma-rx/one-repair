"""
PDF invoice generator using fpdf2.
Returns raw PDF bytes.
Layout modelled on the reference invoice format used by One Repair Solutions.
"""
from datetime import timedelta
from decimal import Decimal

from fpdf import FPDF


def _safe(text: str) -> str:
    """Replace common Unicode punctuation and encode to Latin-1 for Helvetica."""
    return (text or "") \
        .replace("\u2014", "-").replace("\u2013", "-") \
        .replace("\u2019", "'").replace("\u2018", "'") \
        .replace("\u201c", '"').replace("\u201d", '"') \
        .encode("latin-1", errors="replace").decode("latin-1")


def _due_date(invoice_date, payment_terms: str):
    """Return due date based on payment terms."""
    days = {"DUE_ON_RECEIPT": 0, "NET_15": 15, "NET_30": 30, "NET_45": 45}
    return invoice_date + timedelta(days=days.get(payment_terms, 0))


def _terms_label(payment_terms: str) -> str:
    return {
        "DUE_ON_RECEIPT": "Due on Receipt",
        "NET_15": "Net 15",
        "NET_30": "Net 30",
        "NET_45": "Net 45",
    }.get(payment_terms, "")


def generate_invoice_pdf(service_report, ors_settings=None, payment_url: str = "") -> bytes:
    ticket = service_report.ticket
    store  = ticket.store or (ticket.asset.store if ticket.asset else None)
    org    = store.organization if store else None

    # ── ORS company info ──────────────────────────────────────────────────────
    company_name    = (ors_settings and ors_settings.company_name)    or "One Repair Solutions"
    company_address = (ors_settings and ors_settings.company_address) or ""
    company_phone   = (ors_settings and ors_settings.company_phone)   or ""
    company_email   = (ors_settings and ors_settings.company_email)   or ""
    company_website = (ors_settings and getattr(ors_settings, "company_website", "")) or ""
    logo_url        = (ors_settings and ors_settings.logo_url)        or ""

    # ── Dates / terms ─────────────────────────────────────────────────────────
    invoice_date = ticket.completed_at or service_report.created_at
    payment_terms = (org and hasattr(org, "payment_terms") and org.payment_terms) or ""
    terms_label   = _terms_label(payment_terms)
    due_date      = _due_date(invoice_date.date(), payment_terms) if payment_terms else None

    # ── Assets ────────────────────────────────────────────────────────────────
    ticket_assets = list(ticket.ticket_assets.select_related("asset").all())
    if ticket_assets:
        equipment = ", ".join(
            (ta.asset.name if ta.asset else ta.asset_description or "Asset")
            for ta in ticket_assets
        )
        first_asset = ticket_assets[0].asset
        model_number  = (first_asset.model_number  if first_asset else "") or ""
        serial_number = (first_asset.serial_number if first_asset else "") or ""
    elif ticket.asset:
        equipment     = ticket.asset.name
        model_number  = ticket.asset.model_number  or ""
        serial_number = ticket.asset.serial_number or ""
    else:
        equipment     = ticket.asset_description or "-"
        model_number  = serial_number = ""

    # ── Invoice number ────────────────────────────────────────────────────────
    invoice_number = ticket.ticket_number or str(ticket.id)[:8].upper()

    # ── Billing address ───────────────────────────────────────────────────────
    bill_to_name = org.name if org else (store.name if store else "-")
    bill_to_lines = []
    if store:
        for f in [store.address_line1, store.city, store.state, store.zip_code]:
            if f:
                bill_to_lines.append(f)

    # ── Location label ────────────────────────────────────────────────────────
    location_label = store.name if store else ""
    if ticket.ticket_number:
        location_label += f" #{ticket.ticket_number}" if store else ticket.ticket_number

    # ── Line items ────────────────────────────────────────────────────────────
    line_items = []   # (description, detail, qty, unit, unit_price, line_total, is_note)

    if service_report.trip_charge:
        line_items.append(("Field Service Call", "", 1, "Each",
                           float(service_report.trip_charge), float(service_report.trip_charge), False))

    if service_report.labor_cost:
        line_items.append(("Field Service Labor", "", 1, "Hours",
                           float(service_report.labor_cost), float(service_report.labor_cost), False))

    # Inventory parts (PartUsed records)
    for pu in service_report.parts_used.select_related("part").all():
        name   = pu.part.name if pu.part else "-"
        detail = (pu.part.make or "") if pu.part else ""
        line_items.append((name, detail, pu.quantity, "Each",
                           float(pu.unit_price_at_time), float(pu.line_total), False))

    # Extra / custom line items
    for p in (service_report.extra_line_items or []):
        qty   = int(p.get("quantity", 1))
        price = float(p.get("unit_price", 0))
        line_items.append((p.get("name", "-"), p.get("sku", ""), qty, "Each",
                           price, price * qty, False))

    # Service summary as a Job Notes line ($0)
    if service_report.formatted_report:
        line_items.append(("Job Notes", _safe(service_report.formatted_report[:300]),
                           1, "", 0.0, 0.0, True))

    # ── Totals ────────────────────────────────────────────────────────────────
    sub_total   = float(service_report.trip_charge + service_report.labor_cost + service_report.parts_total)
    sales_tax   = float(service_report.sales_tax)
    grand_total = float(service_report.grand_total)
    tax_rate    = float(service_report.tax_rate) if service_report.tax_rate else 0

    # ── Build PDF ─────────────────────────────────────────────────────────────
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(10, 10, 10)

    LM  = 10   # left margin
    EPW = 190  # effective page width (210 - 10*2)

    # ── Logo ──────────────────────────────────────────────────────────────────
    if logo_url:
        try:
            import urllib.request, tempfile, os as _os
            ext = logo_url.split(".")[-1].split("?")[0].lower() or "png"
            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
                urllib.request.urlretrieve(logo_url, tmp.name)
                tmp_path = tmp.name
            pdf.image(tmp_path, x=LM, y=10, h=14)
            _os.unlink(tmp_path)
            pdf.ln(18)
        except Exception:
            pass

    # ── Top section: company info (left) | Invoice header (right) ─────────────
    col = EPW // 2   # 95mm each column

    top_y = pdf.get_y()

    # Left — company block
    pdf.set_xy(LM, top_y)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(col, 6, _safe(company_name), ln=True)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(100, 116, 139)
    for line in filter(None, [company_address, company_phone, company_email, company_website]):
        pdf.set_x(LM)
        pdf.cell(col, 5, _safe(line), ln=True)

    # Right — Invoice title + number + balance
    pdf.set_xy(LM + col, top_y)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(col, 10, "Invoice", align="R", ln=False)
    pdf.ln(10)

    pdf.set_x(LM + col)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(col, 5, f"# {invoice_number}", align="R", ln=True)

    pdf.set_x(LM + col)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(37, 99, 235)
    pdf.cell(col, 7, f"Balance Due  ${grand_total:,.2f}", align="R", ln=True)

    pdf.ln(6)

    # ── Meta block: Bill To (left) | Invoice details (right) ─────────────────
    meta_y = pdf.get_y()

    # Right column — invoice details
    pdf.set_xy(LM + col, meta_y)
    pdf.set_font("Helvetica", "", 8)

    def _meta_row(label, value):
        x_save = pdf.get_x()
        y_save = pdf.get_y()
        pdf.set_x(LM + col)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(28, 5, label, ln=False)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(col - 28, 5, _safe(value), ln=True)

    _meta_row("Invoice Date :", invoice_date.strftime("%d %b %Y"))
    if terms_label:
        _meta_row("Terms :", terms_label)
    if due_date:
        _meta_row("Due Date :", due_date.strftime("%d %b %Y"))
    if location_label:
        _meta_row("Location :", location_label)
    if equipment and equipment != "-":
        _meta_row("Equipment :", equipment)
    _meta_row("Service Date :", invoice_date.strftime("%d %b %Y"))

    # Left column — Bill To
    pdf.set_xy(LM, meta_y)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(col, 5, "Bill To", ln=True)
    pdf.set_x(LM)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(col, 5, _safe(bill_to_name), ln=True)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(100, 116, 139)
    for addr_line in bill_to_lines:
        pdf.set_x(LM)
        pdf.cell(col, 4.5, _safe(addr_line), ln=True)

    # Advance past both columns
    right_y = pdf.get_y()
    pdf.set_y(max(right_y, meta_y + len(bill_to_lines) * 4.5 + 10))
    pdf.ln(6)

    # ── Divider ───────────────────────────────────────────────────────────────
    pdf.set_draw_color(226, 232, 240)
    pdf.set_line_width(0.4)
    pdf.line(LM, pdf.get_y(), LM + EPW, pdf.get_y())
    pdf.ln(4)

    # ── Line items table ──────────────────────────────────────────────────────
    # Columns: # (8) | Description (97) | Qty (18) | Unit (22) | Rate (22) | Amount (23)
    C = [8, 97, 18, 22, 22, 23]   # widths — total = 190

    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(100, 116, 139)
    pdf.set_fill_color(248, 250, 252)
    headers = ["#", "Item & Description", "Qty", "Unit", "Rate", "Amount"]
    aligns  = ["L", "L", "R", "L", "R", "R"]
    for i, (h, w, a) in enumerate(zip(headers, C, aligns)):
        pdf.cell(w, 6, h, fill=True, align=a, ln=(i == len(headers) - 1))

    pdf.set_draw_color(226, 232, 240)
    pdf.set_line_width(0.3)
    pdf.line(LM, pdf.get_y(), LM + EPW, pdf.get_y())

    pdf.set_font("Helvetica", "", 8)
    for idx, (name, detail, qty, unit, unit_price, line_total, is_note) in enumerate(line_items, 1):
        # Row background
        row_y = pdf.get_y()
        if idx % 2 == 0:
            pdf.set_fill_color(248, 250, 252)
            fill = True
        else:
            fill = False

        if is_note:
            # Job Notes — description spans full width, amount blank
            pdf.set_text_color(15, 23, 42)
            pdf.cell(C[0], 5, str(idx), fill=fill, align="L", ln=False)
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(C[1], 5, _safe(name), fill=fill, ln=False)
            pdf.cell(C[2] + C[3] + C[4] + C[5], 5, "", fill=fill, ln=True)
            # Detail / notes text on next line
            if detail:
                pdf.set_font("Helvetica", "", 7.5)
                pdf.set_text_color(100, 116, 139)
                pdf.set_x(LM + C[0])
                pdf.multi_cell(C[1] + C[2] + C[3] + C[4] + C[5], 4.5, _safe(detail))
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(15, 23, 42)
        else:
            # Regular line item
            pdf.set_text_color(15, 23, 42)
            pdf.cell(C[0], 5, str(idx), fill=fill, align="L", ln=False)
            # Name on first line, detail (make/model) below if present
            name_x = pdf.get_x()
            name_y = pdf.get_y()
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(C[1], 5, _safe(name), fill=fill, ln=False)
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(C[2], 5, str(qty), fill=fill, align="R", ln=False)
            pdf.cell(C[3], 5, _safe(unit), fill=fill, align="L", ln=False)
            pdf.cell(C[4], 5, f"{unit_price:,.2f}" if unit_price else "", fill=fill, align="R", ln=False)
            pdf.cell(C[5], 5, f"{line_total:,.2f}" if line_total else "", fill=fill, align="R", ln=True)
            # Sub-detail line (e.g. make for parts)
            if detail:
                pdf.set_font("Helvetica", "", 7.5)
                pdf.set_text_color(100, 116, 139)
                pdf.set_x(LM + C[0])
                pdf.cell(C[1], 4, _safe(detail), ln=True)
                pdf.set_font("Helvetica", "", 8)
                pdf.set_text_color(15, 23, 42)

        pdf.line(LM, pdf.get_y(), LM + EPW, pdf.get_y())

    pdf.ln(4)

    # ── Totals block ──────────────────────────────────────────────────────────
    tl = 155   # label column width (right-aligned)
    tv = 35    # value column width

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(tl, 5, "Sub Total", align="R", ln=False)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(tv, 5, f"${sub_total:,.2f}", align="R", ln=True)

    if tax_rate:
        # Build tax label (e.g. "California State Sales Tax (7.75%)")
        tax_label = f"Sales Tax ({tax_rate}%)"
        pdf.set_text_color(100, 116, 139)
        pdf.cell(tl, 5, tax_label, align="R", ln=False)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(tv, 5, f"${sales_tax:,.2f}", align="R", ln=True)

    pdf.set_draw_color(203, 213, 225)
    pdf.line(130, pdf.get_y(), LM + EPW, pdf.get_y())
    pdf.ln(2)

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(tl, 6, "Total", align="R", ln=False)
    pdf.cell(tv, 6, f"${grand_total:,.2f}", align="R", ln=True)

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(37, 99, 235)
    pdf.cell(tl, 6, "Balance Due", align="R", ln=False)
    pdf.cell(tv, 6, f"${grand_total:,.2f}", align="R", ln=True)

    # ── Manager authorization ─────────────────────────────────────────────────
    if service_report.manager_on_site:
        pdf.ln(6)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(0, 5, "Authorized by", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(0, 5, _safe(service_report.manager_on_site), ln=True)
        if service_report.manager_signature:
            try:
                import base64 as _b64, tempfile, os as _os
                sig_data = service_report.manager_signature
                if sig_data.startswith("data:"):
                    header, b64 = sig_data.split(",", 1)
                    ext = header.split("/")[1].split(";")[0] if "/" in header else "png"
                else:
                    b64, ext = sig_data, "png"
                img_bytes = _b64.b64decode(b64)
                with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
                    tmp.write(img_bytes)
                    tmp_path = tmp.name
                pdf.image(tmp_path, x=LM, w=50)
                _os.unlink(tmp_path)
            except Exception:
                pass

    # ── Payment link ──────────────────────────────────────────────────────────
    if payment_url:
        pdf.ln(6)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(37, 99, 235)
        pdf.cell(0, 5, "Pay Online:", ln=True)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(0, 5, _safe(payment_url), ln=True)

    # ── Notes / footer ────────────────────────────────────────────────────────
    pdf.ln(8)
    pdf.set_draw_color(226, 232, 240)
    pdf.line(LM, pdf.get_y(), LM + EPW, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 5, "Notes", ln=True)
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(0, 5, f"Thank you for choosing {_safe(company_name)}.", ln=True)

    return pdf.output()
