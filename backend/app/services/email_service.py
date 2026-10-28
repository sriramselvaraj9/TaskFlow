"""Modern, responsive email service for TaskFlow member invitations and notifications."""

import asyncio
import logging
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional, Tuple

import httpx

# pyrefly: ignore[missing-import]
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import settings

logger = logging.getLogger("taskflow.email")

# Configure Jinja2 Template Environment for responsive HTML emails
TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html", "xml"]),
)


def _get_brevo_api_config() -> Optional[Tuple[str, str, str]]:
    """Resolves Brevo REST API v3 key and sender information."""
    api_key = getattr(settings, "BREVO_API_KEY", None) or getattr(settings, "BREVO_SMTP_KEY", None)
    if not api_key or "your_" in api_key.lower():
        return None
    api_key = api_key.strip()
    if not (api_key.startswith("xkeysib-") or len(api_key) > 20):
        return None

    raw_sender = (
        getattr(settings, "BREVO_FROM", None)
        or getattr(settings, "BREVO_SENDER_EMAIL", None)
        or getattr(settings, "BREVO_USER", None)
        or "sriramccbp@gmail.com"
    )
    sender_name = "TaskFlow Admin"
    sender_email = "sriramccbp@gmail.com"

    if "<" in raw_sender and ">" in raw_sender:
        parts = raw_sender.split("<")
        sender_name = parts[0].strip(' "\'') or "TaskFlow Admin"
        sender_email = parts[1].split(">")[0].strip()
    elif "@" in raw_sender:
        sender_email = raw_sender.strip(' "\'')

    return api_key, sender_email, sender_name


async def _send_brevo_api_async(
    to_email: str,
    to_name: str,
    invite_url: str,
    inviter_name: str,
    api_key: str,
    sender_email: str,
    sender_name: str,
    designation: Optional[str] = None,
) -> bool:
    """Dispatches invitation email via Brevo REST API v3 over HTTPS (Port 443)."""
    try:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": api_key,
            "content-type": "application/json",
        }
        role_text = f" as {designation.strip()}" if designation and designation.strip() else ""
        text_content = (
            f"Hi {to_name},\n\n"
            f"You have been invited to join TaskFlow by {inviter_name}{role_text}.\n\n"
            f"Please open this link to accept the invitation and set your password:\n{invite_url}\n\n"
            f"This link is valid for 7 days.\n\n"
            f"- The TaskFlow Team"
        )
        html_content = build_invite_html(to_name, invite_url, inviter_name, designation)
        payload = {
            "sender": {"name": sender_name, "email": sender_email},
            "to": [{"email": to_email, "name": to_name or to_email.split("@")[0]}],
            "subject": "You're invited to join TaskFlow - Set up your account",
            "htmlContent": html_content,
            "textContent": text_content,
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code in (200, 201, 202):
                logger.info(
                    "Invite email sent successfully to %s via Brevo REST API v3 (status %d)",
                    to_email,
                    resp.status_code,
                )
                return True
            else:
                logger.warning(
                    "Brevo REST API error for %s (status %d): %s",
                    to_email,
                    resp.status_code,
                    resp.text,
                )
                return False
    except Exception as e:
        logger.warning("Brevo REST API request to %s failed: %s", to_email, str(e))
        return False


def _get_smtp_credentials() -> Tuple[str, int, str, str, str]:
    """Resolves SMTP connection settings with environment and settings fallbacks."""
    host = (
        getattr(settings, "BREVO_SMTP_HOST", None)
        or getattr(settings, "SMTP_HOST", None)
        or "smtp-relay.brevo.com"
    )
    port = (
        getattr(settings, "BREVO_SMTP_PORT", None)
        or getattr(settings, "SMTP_PORT", None)
        or 587
    )
    user = (
        getattr(settings, "BREVO_SMTP_USER", None)
        or getattr(settings, "SMTP_USER", None)
        or getattr(settings, "BREVO_USER", None)
        or ""
    )
    key = (
        getattr(settings, "BREVO_SMTP_KEY", None)
        or getattr(settings, "BREVO_API_KEY", None)
        or getattr(settings, "SMTP_PASS", None)
        or ""
    )
    sender = (
        getattr(settings, "BREVO_SENDER_EMAIL", None)
        or getattr(settings, "BREVO_USER", None)
        or "sriramccbp@gmail.com"
    )

    if "<" in sender and ">" in sender:
        sender = sender.split("<")[1].split(">")[0].strip()

    return host, int(port), user.strip(), key.strip(), sender.strip()


def _send_smtp_sync(
    to_email: str,
    to_name: str,
    invite_url: str,
    inviter_name: str,
    port: int,
    designation: Optional[str] = None,
) -> bool:
    """Synchronous SMTP delivery helper with TLS."""
    try:
        host, _, smtp_user, smtp_key, sender_email = _get_smtp_credentials()

        if not smtp_user or not smtp_key or "your_" in smtp_key:
            logger.warning("SMTP credentials not configured or placeholder detected; skipping SMTP network dispatch.")
            return False

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "You're invited to join TaskFlow - Set up your account"
        msg["From"] = f'"TaskFlow" <{sender_email}>'
        msg["To"] = f'"{to_name}" <{to_email}>'

        role_text = f" as {designation.strip()}" if designation and designation.strip() else ""
        text_content = (
            f"Hi {to_name},\n\n"
            f"You have been invited to join TaskFlow by {inviter_name}{role_text}.\n\n"
            f"Please open this link to accept the invitation and set your password:\n{invite_url}\n\n"
            f"This link is valid for 7 days.\n\n"
            f"- The TaskFlow Team"
        )
        html_content = build_invite_html(to_name, invite_url, inviter_name, designation)

        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        server = smtplib.SMTP(host, port, timeout=10)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(smtp_user, smtp_key)
        server.sendmail(sender_email, [to_email], msg.as_string())
        server.quit()
        logger.info("Invite email sent successfully to %s via port %d", to_email, port)
        return True
    except Exception as e:
        logger.warning("SMTP delivery attempt to %s on port %d failed: %s", to_email, port, str(e))
        return False


async def send_invite_email(
    to_email: str,
    to_name: str,
    invite_url: str,
    inviter_name: str = "Admin",
    designation: Optional[str] = None,
) -> bool:
    """
    Asynchronously sends member invitation email.
    1. First priority: Direct Brevo REST API v3 (HTTPS 443, never blocked by firewalls).
    2. Fallback: SMTP relay (primary port, then fallback port 2525).
    Never blocks or crashes request execution.
    """
    # 1. First priority: Brevo REST API v3
    brevo_cfg = _get_brevo_api_config()
    if brevo_cfg:
        api_key, sender_email, sender_name = brevo_cfg
        logger.info("Attempting invitation delivery to %s via Brevo REST API v3...", to_email)
        success = await _send_brevo_api_async(
            to_email=to_email,
            to_name=to_name,
            invite_url=invite_url,
            inviter_name=inviter_name,
            api_key=api_key,
            sender_email=sender_email,
            sender_name=sender_name,
            designation=designation,
        )
        if success:
            return True
        logger.warning("Brevo REST API delivery failed; falling back to SMTP relay...")

    # 2. Fallback: SMTP relay
    _, primary_port, _, _, _ = _get_smtp_credentials()

    # Attempt 1: primary port (default 587)
    success = await asyncio.to_thread(
        _send_smtp_sync, to_email, to_name, invite_url, inviter_name, primary_port, designation
    )
    if success:
        return True

    # Attempt 2: fallback port (2525)
    logger.info("Retrying email delivery to %s on fallback port 2525...", to_email)
    success_fallback = await asyncio.to_thread(
        _send_smtp_sync, to_email, to_name, invite_url, inviter_name, 2525, designation
    )
    if not success_fallback:
        logger.info("[DEV INVITE LINK] For %s: %s", to_email, invite_url)
    return success_fallback


def build_invite_html(
    name: str,
    invite_url: str,
    inviter_name: str = "Admin",
    designation: Optional[str] = None,
) -> str:
    """Generates modern responsive HTML invitation email using Jinja2 templates."""
    clean_desig = designation.strip() if designation and designation.strip() else None
    try:
        template = jinja_env.get_template("emails/member_invite.html")
        return template.render(
            name=name,
            invite_url=invite_url,
            inviter_name=inviter_name,
            designation=clean_desig,
            current_year=datetime.now().year,
        )
    except Exception as exc:
        logger.warning(
            "Jinja2 template render failed for member_invite.html (%s); falling back to default HTML",
            exc,
        )
        return _fallback_invite_html(name, invite_url, inviter_name, clean_desig)


def build_task_assigned_html(
    assignee_name: str,
    task_title: str,
    project_name: str,
    task_url: str,
    priority: str = "MEDIUM",
    due_date: Optional[str] = None,
    description: Optional[str] = None,
) -> str:
    """Generates modern responsive HTML task assignment notification using Jinja2 templates."""
    template = jinja_env.get_template("emails/task_assigned.html")
    return template.render(
        assignee_name=assignee_name,
        task_title=task_title,
        project_name=project_name,
        task_url=task_url,
        priority=priority,
        due_date=due_date,
        description=description,
        current_year=datetime.now().year,
    )


def _fallback_invite_html(
    name: str,
    invite_url: str,
    inviter_name: str = "Admin",
    designation: Optional[str] = None,
) -> str:
    """Minimal inline HTML fallback if template loader encounters file issues."""
    role_info = f" as <strong>{designation}</strong>" if designation else ""
    return f"""<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background-color: #f1f5f9; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0;">
    <h2 style="color: #4f46e5; margin-top: 0;">TaskFlow Invitation</h2>
    <p>Hi {name},</p>
    <p><strong>{inviter_name}</strong> invited you to join TaskFlow{role_info}.</p>
    <p><a href="{invite_url}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Set Password & Accept</a></p>
    <p style="font-size: 12px; color: #64748b; margin-top: 24px;">Link: {invite_url}</p>
  </div>
</body>
</html>"""



def build_password_reset_html(name: str, reset_url: str) -> str:
    """Generates modern responsive HTML password reset email using Jinja2 templates."""
    try:
        template = jinja_env.get_template("emails/password_reset.html")
        return template.render(
            name=name,
            reset_url=reset_url,
            current_year=datetime.now().year,
        )
    except Exception as exc:
        logger.warning(
            "Jinja2 template render failed for password_reset.html (%s); falling back to default HTML",
            exc,
        )
        return _fallback_reset_html(name, reset_url)


def _fallback_reset_html(name: str, reset_url: str) -> str:
    """Minimal inline HTML fallback if password reset template file is unreadable."""
    return f"""<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background-color: #f1f5f9; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0;">
    <h2 style="color: #4f46e5; margin-top: 0;">TaskFlow Password Reset</h2>
    <p>Hi {name},</p>
    <p>We received a request to reset your password. Click the link below within 15 minutes to choose a new password:</p>
    <p><a href="{reset_url}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Reset Password</a></p>
    <p style="font-size: 12px; color: #64748b; margin-top: 24px;">Link: {reset_url}</p>
  </div>
</body>
</html>"""


async def send_password_reset_email(
    to_email: str,
    to_name: str,
    reset_url: str,
) -> bool:
    """
    Asynchronously sends password reset email.
    1. First priority: Direct Brevo REST API v3 (HTTPS 443).
    2. Fallback: SMTP relay.
    """
    subject = "Reset your TaskFlow password"
    html_content = build_password_reset_html(to_name, reset_url)
    text_content = (
        f"Hi {to_name},\n\n"
        f"We received a request to reset your TaskFlow password.\n\n"
        f"Please open this link to reset your password (valid for 15 minutes):\n{reset_url}\n\n"
        f"If you did not request a password reset, you can safely ignore this email.\n\n"
        f"- The TaskFlow Team"
    )

    brevo_cfg = _get_brevo_api_config()
    if brevo_cfg:
        api_key, sender_email, sender_name = brevo_cfg
        try:
            url = "https://api.brevo.com/v3/smtp/email"
            headers = {
                "accept": "application/json",
                "api-key": api_key,
                "content-type": "application/json",
            }
            payload = {
                "sender": {"name": sender_name, "email": sender_email},
                "to": [{"email": to_email, "name": to_name or to_email.split("@")[0]}],
                "subject": subject,
                "htmlContent": html_content,
                "textContent": text_content,
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code in (200, 201, 202):
                    logger.info("Password reset email sent successfully to %s via Brevo REST API v3", to_email)
                    return True
        except Exception as exc:
            logger.warning("Brevo REST API password reset email failed for %s: %s", to_email, exc)

    def _send_smtp() -> bool:
        try:
            host, port, smtp_user, smtp_key, sender_email = _get_smtp_credentials()
            if not smtp_user or not smtp_key or "your_" in smtp_key:
                return False
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f'"TaskFlow" <{sender_email}>'
            msg["To"] = f'"{to_name}" <{to_email}>'
            msg.attach(MIMEText(text_content, "plain", "utf-8"))
            msg.attach(MIMEText(html_content, "html", "utf-8"))
            server = smtplib.SMTP(host, port, timeout=10)
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_key)
            server.sendmail(sender_email, [to_email], msg.as_string())
            server.quit()
            logger.info("Password reset email sent to %s via SMTP", to_email)
            return True
        except Exception as e:
            logger.warning("SMTP password reset email failed: %s", e)
            return False

    success = await asyncio.to_thread(_send_smtp)
    if not success:
        logger.info("[DEV RESET LINK] For %s: %s", to_email, reset_url)
    return success


class EmailService:
    """Wrapper class for dependency injection."""

    @staticmethod
    async def send_invite_email(
        to_email: str,
        to_name: str,
        invite_url: str,
        inviter_name: str = "Admin",
        designation: Optional[str] = None,
    ) -> bool:
        return await send_invite_email(to_email, to_name, invite_url, inviter_name, designation)

    @staticmethod
    async def send_password_reset_email(
        to_email: str,
        to_name: str,
        reset_url: str,
    ) -> bool:
        return await send_password_reset_email(to_email, to_name, reset_url)


email_service = EmailService()

__all__ = [
    "build_invite_html",
    "build_task_assigned_html",
    "build_password_reset_html",
    "send_invite_email",
    "send_password_reset_email",
    "EmailService",
    "email_service",
]

