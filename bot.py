import os
import time
import requests
from flask import Flask, request

app = Flask(__name__)

# ==============================
# ENVIRONMENT VARIABLES
# ==============================

VERIFY_TOKEN = os.getenv("VERIFY_TOKEN", "change_me")
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", "")
PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID", "")
GRAPH_API_VERSION = os.getenv("GRAPH_API_VERSION", "v23.0")
OWNER_NUMBER = os.getenv("OWNER_NUMBER", "YOUR_NUMBER")

PREFIX = "."
START_TIME = time.time()

# ==============================
# MENU IMAGE
# ==============================

MENU_IMAGE_URL = (
    "https://raw.githubusercontent.com/"
    "gk8715440-gif/Cool-boy-xmd/main/"
    "file_0000000012548243bf5dee8a3c0b406a.png"
)

# ছবির লিংকটি Public হতে হবে।
# লিংক কাজ না করলে GitHub-এ ছবির নাম ও ঠিকানা যাচাই করবে।

# ==============================
# COMMAND LIST
# ==============================

COMMANDS = {
    "AUTO": [
        "AUTOSTATUS", "AUTOREACT", "AUTOTYPING",
        "AUTO", "ANTICALL", "AUTOSEEN"
    ],
    "MEDIA": [
        "SONG", "PLAY", "GAN", "SPOTIFY", "FB",
        "INSTA", "TIKTOK", "YTMP4", "PINTEREST",
        "VIDEO"
    ],
    "AI / TOOLS": [
        "GPT", "PING"
    ],
    "EXTRA": [
        "APK", "SPAM", "SUDO", "GITHUB", "STICKER",
        "IMAGE", "EMOJIMIX", "TTS", "VNOTE", "SAVE",
        "FUNMENU", "GMENU", "XVIDEO"
    ],
    "OWNER": [
        "OWNER", "ALIVE", "PAIR", "UPTIME",
        "MODE PRIVATE", "MODE PUBLIC", "PREFIX SET"
    ],
    "PROFILE": [
        "GETPP", "SETPP", "VV", "VV2", "LOOKUP",
        "STICKER", "GETBIO", "SETBIO", "BLOCK"
    ],
    "GROUP": [
        "HIDETAG", "TAG", "TAGALL", "KICK", "KICKALL",
        "ANTILINK", "DELETE", "PROMOTE", "DEMOTE",
        "WELCOME", "GOODBYE", "ANTISTICKER", "ANTIBOT",
        "GSTATUS", "OPEN", "CLOSE", "WARN", "RESETLINK",
        "ANTIGROUPMENTION"
    ]
}

# ==============================
# WHATSAPP API
# ==============================

def whatsapp_request(payload):
    """Send a request to the WhatsApp Cloud API."""

    if not WHATSAPP_TOKEN or not PHONE_NUMBER_ID:
        print("ERROR: WhatsApp credentials are missing.")
        return None

    url = (
        f"https://graph.facebook.com/"
        f"{GRAPH_API_VERSION}/{PHONE_NUMBER_ID}/messages"
    )

    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=20
        )

        print(
            "WhatsApp API:",
            response.status_code,
            response.text
        )

        return response

    except requests.RequestException as error:
        print("WhatsApp API error:", error)
        return None


def send_message(to, message):
    """Send a WhatsApp text message."""

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {
            "body": message
        }
    }

    return whatsapp_request(payload)


def send_image(to, image_url, caption=""):
    """Send a WhatsApp image using a public URL."""

    image_data = {
        "link": image_url
    }

    if caption:
        image_data["caption"] = caption

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "image",
        "image": image_data
    }

    response = whatsapp_request(payload)

    return response is not None and response.ok


# ==============================
# BUILD MENU
# ==============================

def make_menu():
    """Build the bot menu text."""

    lines = [
        "╭━━━━━━━━━━━━━━━━━━╮",
        "   🤖 COOL-BOY-XMD",
        "        BOT MENU",
        "╰━━━━━━━━━━━━━━━━━━╯",
        "",
        f"Prefix: {PREFIX}",
        ""
    ]

    for category, commands in COMMANDS.items():
        lines.append(f"━━ {category} ━━")

        for command in commands:
            lines.append(f"{PREFIX}{command}")

        lines.append("")

    lines.append(
        "ℹ️ কিছু কমান্ডের কার্যকরী ফিচার "
        "এখনো যোগ করা হয়নি।"
    )

    return "\n".join(lines)


# ==============================
# COMMAND HANDLER
# ==============================

def process_command(sender, message_text):
    """Recognize commands and run available handlers."""

    message_text = message_text.strip()

    if not message_text.startswith(PREFIX):
        return
