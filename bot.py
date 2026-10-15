

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


# সব কমান্ডের তালিকা
COMMANDS = {
    "AUTO": [
        "AUTOSTATUS", "AUTOREACT", "AUTOTYPING",
        "AUTO", "ANTICALL", "AUTOSEEN"
    ],
    "MEDIA": [
        "SONG", "PLAY", "GAN", "SPOTIFY", "FB",
        "INSTA", "TIKTOK", "YTMP4", "PINTEREST", "VIDEO"
    ],
    "AI / TOOLS": ["GPT", "PING"],
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
    



def send_message(to, message):
    """Send a WhatsApp text message using the Cloud API."""

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
            url,
            headers=headers,
            json=payload,
            timeout=20
        )
        print("WhatsApp API:", response.status_code, response.text)
    except requests.RequestException as error:
        print("Send error:", error)


def make_menu():
    """Build a menu containing every listed command."""

    lines = ["🤖 COOL-BOY-XMD BOT MENU\n"]

    for category, commands in COMMANDS.items():
        lines.append(f"\n━━ {category} ━━")

        for command in commands:
            lines.append(f"{PREFIX}{command}")

    lines.append(
        "\n\nNote: Some commands need additional API support "
        "and their own implementation."
    )

    return "\n".join(lines)


def process_command(sender, text):
    """Recognize commands and run implemented handlers."""

    text = text.strip()

    if not text.startswith(PREFIX):
        return

    parts = text[len(PREFIX):].strip().split(maxsplit=1)

    if not parts:
        return

    command = parts[0].upper()
    argument = parts[1] if len(parts) > 1 else ""

    # Basic working commands
    if command == "PING":
        send_message(sender, "🏓 Pong! Bot is online.")
        return

    if command == "ALIVE":
        send_message(sender, "✅ Cool-boy-xmd bot is running.")
        return

    if command == "OWNER":
        send_message(sender, f"👑 Owner: {OWNER_NUMBER}")
        return

    if command == "UPTIME":
        seconds = int(time.time() - START_TIME)
        hours, remainder = divmod(seconds, 3600)
        minutes, secs = divmod(remainder, 60)

        send_message(
            sender,
            f"⏱️ Uptime: {hours}h {minutes}m {secs}s"
        )
        return

    if command in ("MENU", "GMENU", "FUNMENU", "HELP")
        send_message(sender, make_menu())
        return

    if command == "HELP":
        send_message(sender, make_menu())
        return

    # Recognize listed commands, but do not pretend
    # that unsupported features are already implemented.
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
            "handler এখনো যুক্ত করা হয়নি।\n"
            "WhatsApp API-তে এই ফিচার সমর্থিত কি না, "
            "তা যাচাই করে পরের ধাপে যোগ করতে হবে।"
        )
        return

    send_message(
        sender,
        f"❓ Unknown command: {command}\n"
        f"সাহায্যের জন্য {PREFIX}HELP লিখো।"
    )


@app.route("/", methods=["GET"])
def home():
    return "Cool-boy-xmd bot is running!"


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

                    text = message.get("text", {}).get("body", "")

                    if sender and text:
                        print("Incoming message:", sender, text)
                        process_command(sender, text)

    except Exception as error:
        print("Webhook processing error:", error)

    # Acknowledge the webhook event
    return "EVENT_RECEIVED", 200


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000"))
    )import os
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


# সব কমান্ডের তালিকা
COMMANDS = {
    "AUTO": [
        "AUTOSTATUS", "AUTOREACT", "AUTOTYPING",
        "AUTO", "ANTICALL", "AUTOSEEN"
    ],
    "MEDIA": [
        "SONG", "PLAY", "GAN", "SPOTIFY", "FB",
        "INSTA", "TIKTOK", "YTMP4", "PINTEREST", "VIDEO"
    ],
    "AI / TOOLS": ["GPT", "PING"],
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
    """Send a WhatsApp text message using the Cloud API."""

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
            url,
            headers=headers,
            json=payload,
            timeout=20
        )
        print("WhatsApp API:", response.status_code, response.text)
    except requests.RequestException as error:
        print("Send error:", error)


def make_menu():
    """Build a menu containing every listed command."""

    lines = ["🤖 COOL-BOY-XMD BOT MENU\n"]

    for category, commands in COMMANDS.items():
        lines.append(f"\n━━ {category} ━━")

        for command in commands:
            lines.append(f"{PREFIX}{command}")

    lines.append(
        "\n\nNote: Some commands need additional API support "
        "and their own implementation."
    )

    return "\n".join(lines)


def process_command(sender, text):
    """Recognize commands and run implemented handlers."""

    text = text.strip()

    if not text.startswith(PREFIX):
        return

    parts = text[len(PREFIX):].strip().split(maxsplit=1)

    if not parts:
        return

    command = parts[0].upper()
    argument = parts[1] if len(parts) > 1 else ""

    # Basic working commands
    if command == "PING":
        send_message(sender, "🏓 Pong! Bot is online.")
        return

    if command == "ALIVE":
        send_message(sender, "✅ Cool-boy-xmd bot is running.")
        return

    if command == "OWNER":
        send_message(sender, f"👑 Owner: {OWNER_NUMBER}")
        return

    if command == "UPTIME":
        seconds = int(time.time() - START_TIME)
        hours, remainder = divmod(seconds, 3600)
        minutes, secs = divmod(remainder, 60)

        send_message(
            sender,
            f"⏱️ Uptime: {hours}h {minutes}m {secs}s"
        )
        return

    if command in ("GMENU", "FUNMENU""HELP"):
        send_message(sender, make_menu())
        return

    if command == "HELP":
        send_message(sender, make_menu())
        return

    # Recognize listed commands, but do not pretend
    # that unsupported features are already implemented.
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
            "handler এখনো যুক্ত করা হয়নি।\n"
            "WhatsApp API-তে এই ফিচার সমর্থিত কি না, "
            "তা যাচাই করে পরের ধাপে যোগ করতে হবে।"
        )
        return

    send_message(
        sender,
        f"❓ Unknown command: {command}\n"
        f"সাহায্যের জন্য {PREFIX}HELP লিখো।"
    )


@app.route("/", methods=["GET"])
def home():
    return "Cool-boy-xmd bot is running!"


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

                    text = message.get("text", {}).get("body", "")

                    if sender and text:
                        print("Incoming message:", sender, text)
                        process_command(sender, text)

    except Exception as error:
        print("Webhook processing error:", error)

    # Acknowledge the webhook event
    return "EVENT_RECEIVED", 200


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000"))
)







    




    
    
    

    
    

    




    
    
    


    
        
        
