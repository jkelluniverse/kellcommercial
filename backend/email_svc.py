"""Gmail SMTP via App Password — payment-received / payment-overdue notifications."""
import os
import logging
import asyncio
from email.message import EmailMessage
import aiosmtplib

logger = logging.getLogger("email_svc")


def is_configured() -> bool:
    return bool(os.environ.get("GMAIL_USER")) and bool(os.environ.get("GMAIL_APP_PASSWORD"))


async def send_email(to: list[str], subject: str, html: str, text: str = "") -> bool:
    user = os.environ.get("GMAIL_USER", "")
    pwd = os.environ.get("GMAIL_APP_PASSWORD", "")
    from_name = os.environ.get("EMAIL_FROM_NAME", "Kell Commercial")
    if not user or not pwd:
        logger.warning("Email skipped — GMAIL credentials not set")
        return False
    if not to:
        return False
    msg = EmailMessage()
    msg["From"] = f"{from_name} <{user}>"
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject
    msg.set_content(text or "Please view this message in an HTML-capable client.")
    msg.add_alternative(html, subtype="html")
    try:
        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=465,
            use_tls=True,
            username=user,
            password=pwd,
            timeout=20,
        )
        logger.info("Email sent to %s subj=%s", to, subject)
        return True
    except Exception as e:
        logger.error("Email send failed: %s", e)
        return False


def _wrap(content_html: str) -> str:
    return f"""\
<div style="font-family:-apple-system,Segoe UI,sans-serif;background:#ffffff;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:2px solid #b91c1c;border-radius:6px;overflow:hidden;">
    <div style="padding:18px 24px;border-bottom:1px solid #e5dcc4;background:#ffffff;">
      <div style="color:#b91c1c;font-weight:800;font-size:22px;letter-spacing:2px;">KELL COMMERCIAL</div>
      <div style="color:#a98a3f;font-size:11px;letter-spacing:3px;">EST. 1978</div>
    </div>
    <div style="padding:24px;color:#0a0a0a;line-height:1.55;">
      {content_html}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #e5dcc4;color:#a89e8c;font-size:11px;">
      Automated notification · Kell Commercial Asset Management
    </div>
  </div>
</div>"""


async def send_payment_received(to: list[str], tenant: str, address: str, amount: float, paid_on: str) -> bool:
    html = _wrap(
        f"<h2 style='color:#b91c1c;margin:0 0 12px;'>Payment received</h2>"
        f"<p><strong style='color:#a98a3f;'>{tenant}</strong> &mdash; {address}</p>"
        f"<p>Amount: <strong>${amount:,.2f}</strong><br/>Received: {paid_on}</p>"
    )
    return await send_email(to, f"Payment received — {address}", html)


async def send_payment_overdue(to: list[str], tenant: str, address: str, amount_due: float, days_overdue: int) -> bool:
    html = _wrap(
        f"<h2 style='color:#b91c1c;margin:0 0 12px;'>Payment overdue</h2>"
        f"<p><strong style='color:#a98a3f;'>{tenant}</strong> &mdash; {address}</p>"
        f"<p>Outstanding: <strong>${amount_due:,.2f}</strong><br/>Days past due: <strong>{days_overdue}</strong></p>"
    )
    return await send_email(to, f"Payment overdue — {address}", html)
