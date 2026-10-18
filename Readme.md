Cool-boy-xmd — Render setup

Files:
- index.js
- package.json

Render:
- Runtime: Node
- Build command: npm install
- Start command: npm start
- Environment:
  - PHONE_NUMBER = WhatsApp number with country code, digits only (example format: 91XXXXXXXXXX; do not include + or spaces)
  - OWNER_NUMBER = owner number with country code, digits only
  - PREFIX = . (optional)
  - BOT_NAME = Cool-boy-xmd (optional)
  - MENU_IMAGE = direct image URL (optional)
  - AUTH_DIR = ./auth_info_baileys (optional)

Pairing:
1. Deploy and watch Logs for the latest pairing code.
2. On the same WhatsApp account, open Linked devices > Link a device > Link with phone number instead.
3. Enter the newest code quickly.
4. Wait for "WhatsApp connected!" in Render Logs.

Important:
- This code cannot guarantee that WhatsApp will accept a pairing code. Current Baileys GitHub reports describe code-entry failures followed by 401 even when the code and number are correct. If 401 repeats after a fresh code, stop retrying repeatedly; it may be a Baileys/WhatsApp protocol-side issue, not something a code edit can guarantee to fix.
- Do not run multiple instances of the same bot against the same auth folder.
- For stable session persistence on Render, configure a persistent disk and set AUTH_DIR to a path on that disk. Without persistent storage, restarts/redeploys may lose auth state.
- Media/AI commands (play, song, GPT, sticker, weather, etc.) are placeholders and need separate API/feature integrations.
- welcome/goodbye settings and warning counts are in-memory and reset when the process restarts.
- Keep the auth folder private; never share or commit session credentials.
