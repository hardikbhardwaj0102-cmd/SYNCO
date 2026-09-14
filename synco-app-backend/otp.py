import os
import secrets
import time

import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException


# Store OTPs temporarily in memory
# Later we can move this to Redis/database.
otp_store = {}


OTP_EXPIRY_SECONDS = 5 * 60


def generate_otp():
    return str(secrets.randbelow(900000) + 100000)


def send_otp_email(email):
    otp = generate_otp()

    # Save OTP
    otp_store[email.lower()] = {
        "otp": otp,
        "expires_at": time.time() + OTP_EXPIRY_SECONDS
    }

    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key["api-key"] = os.getenv("BREVO_API_KEY")

    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
        sib_api_v3_sdk.ApiClient(configuration)
    )

    sender = sib_api_v3_sdk.SendSmtpEmailSender(
        name=os.getenv("BREVO_SENDER_NAME", "SYNCO"),
        email=os.getenv("BREVO_SENDER_EMAIL")
    )

    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        sender=sender,
        to=[
            {
                "email": email
            }
        ],
        subject="Your SYNCO Verification Code",
        html_content=f"""
        <html>
            <body style="
                margin: 0;
                padding: 0;
                background: #0a0a0a;
                font-family: Arial, sans-serif;
            ">

                <div style="
                    max-width: 500px;
                    margin: 40px auto;
                    background: #111111;
                    padding: 40px;
                    border-radius: 12px;
                    color: white;
                ">

                    <h1 style="margin-bottom: 10px;">
                        Welcome to SYNCO
                    </h1>

                    <p style="color: #aaaaaa;">
                        Use the verification code below to
                        complete your registration.
                    </p>

                    <div style="
                        margin: 30px 0;
                        padding: 20px;
                        background: #1c1c1c;
                        border-radius: 8px;
                        text-align: center;
                    ">

                        <span style="
                            font-size: 32px;
                            font-weight: bold;
                            letter-spacing: 8px;
                        ">
                            {otp}
                        </span>

                    </div>

                    <p style="color: #888888;">
                        This code expires in 5 minutes.
                    </p>

                    <p style="
                        margin-top: 30px;
                        color: #666666;
                        font-size: 13px;
                    ">
                        If you didn't request this code,
                        you can safely ignore this email.
                    </p>

                </div>

            </body>
        </html>
        """
    )

    try:

        response = api_instance.send_transac_email(
            send_smtp_email
        )

        print("Brevo OTP email sent:", response)

        return True

    except ApiException as e:

        print("Brevo API Error:", e)

        # Remove OTP if email failed
        otp_store.pop(email.lower(), None)

        return False


def verify_otp(email, otp):

    email = email.lower()

    stored = otp_store.get(email)

    if not stored:
        return False, "No OTP found"

    if time.time() > stored["expires_at"]:
        otp_store.pop(email, None)

        return False, "OTP expired"

    if stored["otp"] != otp:
        return False, "Invalid OTP"

    # OTP successfully verified
    otp_store.pop(email, None)

    return True, "OTP verified"



def send_password_reset_email(email, reset_link):
    """
    Sends a password reset email through Brevo.
    """

    try:
        import os
        import requests

        api_key = os.getenv("BREVO_API_KEY")

        if not api_key:
            print("BREVO_API_KEY is not configured")
            return False

        url = "https://api.brevo.com/v3/smtp/email"

        headers = {
            "accept": "application/json",
            "api-key": api_key,
            "content-type": "application/json"
        }

        sender_email = os.getenv(
            "BREVO_SENDER_EMAIL"
        )

        sender_name = os.getenv(
            "BREVO_SENDER_NAME",
            "SYNCO"
        )

        if not sender_email:
            print("BREVO_SENDER_EMAIL is not configured")
            return False

        payload = {
            "sender": {
                "name": sender_name,
                "email": sender_email
            },

            "to": [
                {
                    "email": email
                }
            ],

            "subject": "Reset your SYNCO password",

            "htmlContent": f"""
                <div style="
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 40px 20px;
                    color: #111;
                ">

                    <h1 style="
                        font-size: 32px;
                        letter-spacing: 2px;
                        margin-bottom: 10px;
                    ">
                        SYNCO
                    </h1>

                    <h2>
                        Reset your password
                    </h2>

                    <p>
                        We received a request to reset the
                        password for your SYNCO account.
                    </p>

                    <p>
                        Click the button below to create
                        a new password.
                    </p>

                    <div style="
                        margin: 30px 0;
                    ">

                        <a href="{reset_link}"
                           style="
                            display: inline-block;
                            padding: 14px 24px;
                            background: #000000;
                            color: #ffffff;
                            text-decoration: none;
                            border-radius: 8px;
                            font-weight: bold;
                        ">
                            Reset Password
                        </a>

                    </div>

                    <p style="
                        color: #666;
                        font-size: 14px;
                    ">
                        This link will expire in 15 minutes.
                    </p>

                    <p style="
                        color: #666;
                        font-size: 14px;
                    ">
                        If you didn't request a password reset,
                        you can safely ignore this email.
                    </p>

                    <hr style="
                        border: none;
                        border-top: 1px solid #ddd;
                        margin: 30px 0;
                    ">

                    <p style="
                        color: #999;
                        font-size: 12px;
                    ">
                        This is an automated email from SYNCO.
                        Please do not reply to this email.
                    </p>

                </div>
            """
        }

        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=10
        )

        if response.status_code in (200, 201, 202):
            print(
                f"Password reset email sent to {email}"
            )
            return True

        print(
            "Brevo password reset error:",
            response.status_code,
            response.text
        )

        return False

    except Exception as e:

        print(
            "Password reset email exception:",
            e
        )

        return False