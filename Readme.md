Cool-boy-xmd merged starter files

Files:
- index.js
- package.json

Render:
- Runtime: Node
- Build command: npm install
- Start command: npm start
- Environment variables:
  - PHONE_NUMBER = country code + phone digits, digits only (example format: 91XXXXXXXXXX)
  - OWNER_NUMBER = owner number with country code, digits only
  - PREFIX = . (optional)
  - BOT_NAME = Cool-boy-xmd (optional)

Important:
- This keeps the menu image and core commands, and adds a number of group/owner toggles.
- Some menu commands intentionally reply that a separate API/integration is needed; they are not falsely represented as complete.
- Group settings and warnings are currently in memory and reset when the service restarts.
- Never share the pairing code publicly. If WhatsApp returns 401/logged out, diagnose the session/account rather than repeatedly changing browser strings.
