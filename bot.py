import os
import time
import requests
from flask import Flask, request

app = Flask(__name__)

# Environment variables
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN", "change_me")
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", "")
PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID", "")
GRAPH_API_VERSION = os.getenv("GRAPH_API_VERSION", "v23.0")
OWNER_NUMBER = os.getenv("OWNER_NUMBER", "YOUR_NUMBER")

PREFIX = "."
START_TIME = time.time()

# Public image URL for the bot menu
MENU_IMAGE_URL = (
    "https://raw.githubusercontent.com/"
    "gk8715440-gif/Cool-boy-xmd/main/"
    "file_0000000012548243bf5dee8a3c0b406a.png"
)

# Command list
COMMANDS = {
    "AUTO": [
        "AUTOSTATUS", "AUTOREACT", "AUTOTYPING",
        "AUTO", "ANTICALL", "AUTOSEEN"
    ],
    "MEDIA": [
        "SONG", "PLAY", "GAN", "SPOTIFY", "FB",
        "INSTA", "TIKTOK", "YTMP4", "PINTEREST", "VIDEO"
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


def send_message(to, message):
    """Send a WhatsApp text message."""
    if not WHATSAPP_TOKEN or not PHONE_NUMBER_ID:
        print("Missing WhatsApp API credentials.")
        return

    url = (
        f"https://graph.facebook.com/"
        f"{GRAPH_API_VERSION}/{PHONE_NUMBER_ID}/messages"
    )

    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"body": message}
    }

    try:
        response = requests.post(
            url, headers=headers, json=payload, timeout=20
        )
        print("WhatsApp text API:", response.status_code, response.text)
    except requests.RequestException as error:
        print("Send error:", error)


def send_image(to, image_url, caption=""):
    """Send a WhatsApp image."""
    if not WHATSAPP_TOKEN or not PHONE_NUMBER_ID:
        print("Missing WhatsApp API credentials.")
        return False

    url = (
        f"https://graph.facebook.com/"
        f"{GRAPH_API_VERSION}/{PHONE_NUMBER_ID}/messages"
    )

    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }

    image_data = {"link": image_url}
    if caption:
        image_data["caption"] = caption

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "image",
        "image": image_data
    }

    try:
        response = requests.post(
            url, headers=headers, json=payload, timeout=20
        )
        print("WhatsApp image API:", response.status_code, response.text)
        return response.ok
    except requests.RequestException as error:
        print("Image send error:", error)
        return False


def make_menu():
    """Build the bot menu."""
    lines = ["🤖 COOL-BOY-XMD BOT MENU"]

    for category, commands in COMMANDS.items():
        lines.append(f"\n━━ {category} ━━")
        for command in commands:
            lines.append(f"{PREFIX}{command}")

    lines.append(
        "\n\nNote: Some commands are listed but "
        "their features are not implemented yet."
    )

    return "\n".join(lines)


def process_command(sender, text):
    """Recognize commands and run available handlers."""
    text = text.strip()

    if not text.startswith(PREFIX):
        return

    parts = text[len(PREFIX):].strip().split(maxsplit=1)
    if not parts:
        return

    command = parts[0].upper()

    # Ping command
    if command == "PING":
        send_message(sender, "🏓 Pong! Bot is online.")
        return

    # Alive command
    if command == "ALIVE":
        send_message(sender, "✅ Cool-boy-xmd bot is running.")
        return

    # Owner command
    if command == "OWNER":
        send_message(sender, f"👑 Owner: {OWNER_NUMBER}")
        return

    # Uptime command
    if command == "UPTIME":
        seconds = int(time.time() - START_TIME)
        hours, remainder = divmod(seconds, 3600)
        minutes, secs = divmod(remainder, 60)

        send_message(
            sender,
            f"⏱️ Uptime: {hours}h {minutes}m {secs}s"
        )
        return

    # Menu commands: send image first, then menu text
    if command in ("MENU", "GMENU", "FUNMENU", "HELP"):
        send_image(sender, MENU_IMAGE_URL)
        send_message(sender, make_menu())
        return

    # Other listed commands
    all_commands = {
        item
        for items in COMMANDS.values()
        for item in items
    }

    if command in all_commands or command == "PREFIX":
        send_message(
            sender,
            f"📌 Command: {PREFIX}{command}\n"
            "এই কমান্ড শনাক্ত হয়েছে, কিন্তু এর কাজের "
            "handler এখনো যুক্ত করা হয়নি।"
        )
        return

    # Unknown command
    send_message(
        sender,
        f"❓ Unknown command: {command}\n"
        f"সাহায্যের জন্য {PREFIX}HELP লিখো।"
    )


@app.route("/", methods=["GET"])
def home():
    return "Cool-boy-xmd bot is running!", 200


@app.route("/webhook", methods=["GET"])
def verify_webhook():
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")

    if mode == "subscribe" and token == VERIFY_TOKEN:
        return challenge or "", 200

    return "Verification failed", 403


@app.route("/webhook", methods=["POST"])
def webhook():
    data = request.get_json(silent=True) or {}

    try:
        entries = data.get("entry", [])

        for entry in entries:
            for change in entry.get("changes", []):
                value = change.get("value", {})

                for message in value.get("messages", []):
                    sender = message.get("from", "")
                    message_type = message.get("type", "")

                    if message_type != "text":
                        continue

                    text = message.get("text", {}).get