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
    button_label: str = "",
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
        label = button_label or f"Pay Now — ${service_report.grand_total:.2f}"
        pay_button = f"""
        <div style="text-align: center; margin: 24px 0;">
          <a href="{payment_url}" style="background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
            {label}
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

          <!-- Header: table layout for email client compatibility -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e3a5f; border-radius:8px 8px 0 0;">
            <tr>
              {"" if not logo_url else f'<td width="56" style="padding:20px 0 20px 24px; vertical-align:middle;"><img src="{logo_url}" alt="" width="40" height="40" style="border-radius:6px; background:white; padding:2px; display:block;" /></td>'}
              <td style="padding:20px 24px; vertical-align:middle;">
                <div style="color:white; font-size:19px; font-weight:bold; margin:0;">{company_name}</div>
                <div style="color:#93c5fd; font-size:12px; margin-top:3px;">Field Service Management</div>
              </td>
            </tr>
          </table>

          <!-- Body -->
          <div style="background:#f8fafc; padding:32px; border:1px solid #e2e8f0; border-top:none; border-radius:0 0 8px 8px;">

            <h2 style="font-size:17px; color:#0f172a; margin-top:0; margin-bottom:8px;">Your service invoice is ready</h2>
            <p style="color:#475569; font-size:13px; line-height:1.6; margin-top:0;">
              Thank you for trusting One Repair Solutions with your equipment. Your technician has completed
              the service and we have attached your invoice for your records. Please review the details below
              and don't hesitate to reach out if you have any questions.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px; border-collapse:collapse;">
              <tr>
                <td style="padding:9px 0; color:#64748b; font-size:13px; border-bottom:1px solid #e2e8f0;">Invoice #</td>
                <td style="padding:9px 0; font-weight:bold; font-size:13px; border-bottom:1px solid #e2e8f0;">{invoice_number}</td>
              </tr>
              <tr>
                <td style="padding:9px 0; color:#64748b; font-size:13px; border-bottom:1px solid #e2e8f0;">Equipment</td>
                <td style="padding:9px 0; font-size:13px; border-bottom:1px solid #e2e8f0;">{asset_name}</td>
              </tr>
              <tr>
                <td style="padding:12px 0 4px; font-size:15px; font-weight:bold;">Total Due</td>
                <td style="padding:12px 0 4px; font-size:15px; font-weight:bold; color:#2563eb;">${service_report.grand_total:.2f}</td>
              </tr>
            </table>

            {pay_button}

            <p style="color:#64748b; font-size:12px; margin-top:20px; margin-bottom:0;">
              Your full invoice PDF is attached to this email. Work photos are included as separate attachments.
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
