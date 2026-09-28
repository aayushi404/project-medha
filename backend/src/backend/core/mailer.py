"""Outbound email. `console` backend (dev) logs the message instead of sending
it, so verification/reset links are usable locally without an SMTP account.
Production config is required to use SMTP (see core/config.py).

Sending is blocking I/O -- always call `send_email` from a BackgroundTask so
the HTTP response (and its timing) never depends on the mail server.
"""

import logging
import smtplib
import ssl
from email.message import EmailMessage

from backend.core.config import settings

logger = logging.getLogger("backend.mailer")


def send_email(to: str, subject: str, body: str) -> None:
    if settings.mail_backend != "smtp":
        # Dev only: this deliberately logs the whole body, including any link.
        logger.info("mail[console] to=%s subject=%s\n%s", to, subject, body)
        return
    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_starttls:
                smtp.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(msg)
    except Exception:
        # never surface mail-server details to (or through) the requester
        logger.exception("mail_send_failed to_domain=%s", to.rpartition("@")[2])
