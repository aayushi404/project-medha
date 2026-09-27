"""The transactional emails the auth system sends. Each helper queues the send
on a BackgroundTask so the HTTP response never waits on (or reveals anything
about) the mail server."""

from fastapi import BackgroundTasks

from backend.core.mailer import send_email

_SIGN_OFF = "\n\n-- Medha\nIf you didn't expect this email, you can safely ignore it."


def verification(background: BackgroundTasks, to: str, name: str, link: str) -> None:
    background.add_task(
        send_email,
        to,
        "Verify your email for Medha",
        f"Hello {name},\n\nPlease confirm this email address to finish setting up your Medha account:\n\n{link}\n\n"
        f"This link works once and expires in 24 hours.{_SIGN_OFF}",
    )


def password_reset(background: BackgroundTasks, to: str, name: str, link: str) -> None:
    background.add_task(
        send_email,
        to,
        "Reset your Medha password",
        f"Hello {name},\n\nWe received a request to reset your Medha password. Choose a new one here:\n\n{link}\n\n"
        f"This link works once and expires in 30 minutes. If you didn't ask for this, ignore this email -- "
        f"your password has not changed.{_SIGN_OFF}",
    )


def already_registered(background: BackgroundTasks, to: str, name: str) -> None:
    background.add_task(
        send_email,
        to,
        "You already have a Medha account",
        f"Hello {name},\n\nSomeone (hopefully you) tried to register this email address on Medha, but an account "
        f"already exists. You can log in, or use \"Forgot password\" on the login page if you don't remember your "
        f"password.{_SIGN_OFF}",
    )
