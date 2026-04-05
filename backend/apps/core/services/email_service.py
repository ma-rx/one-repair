"""
Sends the PDF invoice via Resend.
"""
import base64
import logging

import resend
from django.conf import settings

logger = logging.getLogger(__name__)


def send_invoice_email(
    to_email: str,
    service_report,
    pdf_bytes: bytes,
    payment_url: str = "",
    ors_settings=None,
    work_image_urls: list = None,
) -> bool:
    resend.api_key = settings.RESEND_API_KEY

    ticket   = service_report.ticket
    company_name = (ors_settings and ors_settings.company_name) or "One Repair Solutions"
    logo_url     = (ors_settings and ors_settings.logo_url) or ""

    # Best asset name
    first_ta = ticket.ticket_assets.select_related("asset").first()
    if first_ta:
        asset_name = first_ta.asset.name if first_ta.asset else (first_ta.asset_description or "Service")
    elif ticket.asset:
        asset_name = ticket.asset.name
    else:
        asset_name = ticket.asset_description or "Service"

    invoice_number = ticket.ticket_number or f"SR-{str(service_report.id)[:8].upper()}"

    pay_button = ""
    if payment_url:
        pay_button = f"""
        <div style="text-align: center; margin: 24px 0;">
          <a href="{payment_url}" style="background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
            Pay Now — ${service_report.grand_total:.2f}
          </a>
        </div>
        """

    # Fetch work photos and attach (max 10, skip failures silently)
    import urllib.request as _urllib
    photo_attachments = []
    for idx, url in enumerate((work_image_urls or [])[:10]):
        try:
            with _urllib.urlopen(url, timeout=10) as resp:
                img_bytes = resp.read()
            ext = url.split("?")[0].rsplit(".", 1)[-1].lower() or "jpg"
            photo_attachments.append({
                "filename": f"photo_{idx + 1}.{ext}",
                "content": base64.b64encode(img_bytes).decode("utf-8"),
            })
        except Exception:
            pass

    params = {
        "from": settings.RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": f"Service Invoice {invoice_number} — {asset_name}",
        "html": f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a;">
          <div style="background: #1e3a5f; padding: 24px 32px; border-radius: 8px 8px 0 0; display: flex; align-items: center; gap: 16px;">
            {"" if not logo_url else f'<img src="{logo_url}" alt="Logo" style="height: 40px; width: 40px; border-radius: 6px; object-fit: contain; background: white; padding: 2px;" />'}
            <div>
              <h1 style="color: white; margin: 0; font-size: 20px;">{company_name}</h1>
              <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">Field Service Management</p>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="font-size: 16px; color: #0f172a; margin-top: 0;">Your service invoice is ready</h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Invoice #</td>
                <td style="padding: 8px 0; font-weight: bold; font-size: 13px;">{invoice_number}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Asset</td>
                <td style="padding: 8px 0; font-size: 13px;">{asset_name}</td>
              </tr>
              <tr style="border-top: 2px solid #e2e8f0;">
                <td style="padding: 12px 0 0; font-size: 15px; font-weight: bold;">Total Due</td>
                <td style="padding: 12px 0 0; font-size: 15px; font-weight: bold; color: #2563eb;">${service_report.grand_total:.2f}</td>
              </tr>
            </table>
            {pay_button}
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">
              The full PDF invoice is attached to this email.
            </p>
          </div>
        </div>
        """,
        "attachments": [
            {
                "filename": f"{invoice_number}.pdf",
                "content": base64.b64encode(pdf_bytes).decode("utf-8"),
            },
            *photo_attachments,
        ],
    }

    try:
        resend.Emails.send(params)
        return True
    except Exception as exc:
        logger.error("Resend failed for service report %s: %s", service_report.id, exc)
        raise
