"""Tests for backend email service: HTML generation, SMTP error handling, and async dispatch."""

import pytest
from unittest.mock import MagicMock, patch

from app.services.email_service import build_invite_html, send_invite_email, email_service


def test_build_invite_html():
    """Verify HTML generation contains recipient name, link, designation, and TaskFlow branding."""
    html = build_invite_html(
        name="Alice",
        invite_url="http://localhost:3000/auth/set-password?token=123",
        inviter_name="Bob",
        designation="Software Engineer",
    )
    assert "Alice" in html
    assert "Bob" in html
    assert "Software Engineer" in html
    assert "http://localhost:3000/auth/set-password?token=123" in html
    assert "TaskFlow" in html


@pytest.mark.asyncio
async def test_send_invite_email_handles_smtp_failure():
    """Ensure SMTP connection errors do not raise uncaught exceptions and return False gracefully."""
    with patch("smtplib.SMTP", side_effect=Exception("SMTP connection refused")), \
         patch("app.services.email_service._get_smtp_credentials", return_value=("smtp.example.com", 587, "user", "secret_pass", "noreply@example.com")):
        success = await send_invite_email(
            to_email="test@example.com",
            to_name="Test User",
            invite_url="http://localhost:3000/auth/set-password?token=abc",
            inviter_name="Admin",
        )
        assert success is False


@pytest.mark.asyncio
async def test_send_invite_email_success():
    """Verify successful SMTP dispatch flow."""
    mock_smtp_instance = MagicMock()
    with patch("smtplib.SMTP", return_value=mock_smtp_instance), \
         patch("app.services.email_service._get_smtp_credentials", return_value=("smtp.example.com", 587, "user", "secret_pass", "noreply@example.com")):
        success = await email_service.send_invite_email(
            to_email="test@example.com",
            to_name="Test User",
            invite_url="http://localhost:3000/auth/set-password?token=abc",
            inviter_name="Admin",
            designation="Full Stack Dev",
        )
        assert success is True
        assert mock_smtp_instance.starttls.called
        assert mock_smtp_instance.sendmail.called
