"""
Sends the PDF invoice via Resend.
"""
import base64
import logging

import resend
from django.conf import settings

logger = logging.getLogger(__name__)


def send_invoice_email(to_email: str, service_report, pdf_bytes: bytes) -> bool:
    resend.api_key = settings.RESEND_API_KEY

    ticket = service_report.ticket
    asset = ticket.asset
    invoice_number = f"SR-{str(service_report.id)[:8].upper()}"

    params = {
        "from": settings.RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": f"Service Invoice {invoice_number} — {asset.name}",
        "html": f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a;">
          <div style="background: #1e3a5f; padding: 24px 32px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">One Repair Solutions</h1>
            <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">Field Service Management</p>
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
                <td style="padding: 8px 0; font-size: 13px;">{asset.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Symptom</td>
                <td style="padding: 8px 0; font-size: 13px;">{ticket.symptom_code.replace('_', ' ').title()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Resolution</td>
                <td style="padding: 8px 0; font-size: 13px;">{service_report.resolution_code.replace('_', ' ').title()}</td>
              </tr>
              <tr style="border-top: 2px solid #e2e8f0;">
                <td style="padding: 12px 0 0; font-size: 15px; font-weight: bold;">Total Due</td>
                <td style="padding: 12px 0 0; font-size: 15px; font-weight: bold; color: #2563eb;">${service_report.grand_total:.2f}</td>
              </tr>
            </table>
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
            }
        ],
    }

    try:
        resend.Emails.send(params)
        return True
    except Exception as exc:
        logger.error("Resend failed for service report %s: %s", service_report.id, exc)
        raise
