import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} from '@whiskeysockets/baileys';

import pino from 'pino';
import express from 'express';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

const PHONE_NUMBER = (process.env.PHONE_NUMBER || '')
  .replace(/\D/g, '');

const OWNER_NUMBER = (process.env.OWNER_NUMBER || '')
  .replace(/\D/g, '');

const MENU_IMAGE =
  process.env.MENU_IMAGE || '';

const PREFIX = '.';
const START_TIME = Date.now();

app.get('/', (req, res) => {
  res.send('Cool-boy-xmd bot is running!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

const logger = pino({ level: 'silent' });

let sock;
let pairingRequested = false;
let reconnecting = false;

function getText(msg) {
  const m = msg.message;
  if (!m) return '';

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  ).trim();
}

function getUptime() {
  const total = Math.floor(
    (Date.now() - START_TIME) / 1000
  );

  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return `${h}h ${m}m ${s}s`;
}

function makeMenu() {
  return `╭━━━〔 COOL-BOY-XMD 〕━━━╮
┃
┃ 👑 OWNER
┃ ${PREFIX}owner
┃ ${PREFIX}alive
┃ ${PREFIX}ping
┃ ${PREFIX}uptime
┃
┃ 🎵 MEDIA
┃ ${PREFIX}song
┃ ${PREFIX}play
┃ ${PREFIX}video
┃ ${PREFIX}sticker
┃
┃ 🤖 AI / TOOLS
┃ ${PREFIX}gpt
┃ ${PREFIX}github
┃
┃ 👥 GROUP
┃ ${PREFIX}tagall
┃ ${PREFIX}hidetag
┃ ${PREFIX}kick
┃ ${PREFIX}promote
┃ ${PREFIX}demote
┃ ${PREFIX}open
┃ ${PREFIX}close
┃ ${PREFIX}antilink
┃
╰━━━━━━━━━━━━━━━━━━╯

⚠️ যেসব কমান্ডের হ্যান্ডলার যোগ করা হয়নি,
সেগুলো এখনো কাজ করবে না।

Powered by Cool-boy-xmd`;
}

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState('./auth_info_baileys');

  sock = makeWASocket({
    auth: state,
    logger,
    browser: ['Windows', 'Chrome', 'Chrome 114.0.5735.198'],
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (
      connection === 'connecting' &&
      !state.creds.registered &&
      PHONE_NUMBER &&
      !pairingRequested
    ) {
      pairingRequested = true;

      try {
        await new Promise(resolve => setTimeout(resolve, 1500));

        const code = await sock.requestPairingCode(
          PHONE_NUMBER
        );

        console.log('WhatsApp Pairing Code:', code);
        console.log(
          'WhatsApp > Linked devices > Link a device > Link with phone number'
        );
      } catch (err) {
        pairingRequested = false;
        console.error('Pairing code error:', err.message);
      }
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected successfully');
    }

    if (connection === 'close' && !reconnecting) {
      const status =
        lastDisconnect?.error?.output?.statusCode;

      console.log('WhatsApp disconnected:', status);

      if (status !== DisconnectReason.loggedOut) {
        reconnecting = true;
        setTimeout(() => {
          reconnecting = false;
          pairingRequested = false;
          startBot().catch(console.error);
        }, 5000);
      } else {
        console.log(
          'Logged out. Re-link WhatsApp before reconnecting.'
        );
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const jid = msg.key.remoteJid;

      if (!jid || jid === 'status@broadcast') continue;

      const body = getText(msg);
      if (!body.startsWith(PREFIX)) continue;

      const args = body.slice(PREFIX.length).trim().split(/\s+/);
      const command = (args.shift() || '').toLowerCase();

      try {
        switch (command) {
          case 'menu':
          case 'help': {
            const caption = makeMenu();

            if (MENU_IMAGE) {
              await sock.sendMessage(jid, {
                image: { url: MENU_IMAGE },
                caption
              });
            } else {
              await sock.sendMessage(jid, {
                text: caption
              });
            }
            break;
          }

          case 'ping':
            await sock.sendMessage(jid, {
              text: '🏓 Pong!'
            });
            break;

          case 'alive':
            await sock.sendMessage(jid, {
              text: '✅ Cool-boy-xmd is running!'
            });
            break;

          case 'owner':
            await sock.sendMessage(jid, {
              text: OWNER_NUMBER
                ? `👑 Owner: ${OWNER_NUMBER}`
                : 'Owner number is not configured.'
            });
            break;

          case 'uptime':
            await sock.sendMessage(jid, {
              text: `⏱️ Uptime: ${getUptime()}`
            });
            break;

          default:
            await sock.sendMessage(jid, {
              text:
                `❌ Unknown command: ${PREFIX}${command}\n` +
                `Type ${PREFIX}menu to see commands.`
            });
        }
      } catch (err) {
        console.error('Command error:', err.message);
      }
    }
  });
}

if (!PHONE_NUMBER) {
  console.error(
    'Set PHONE_NUMBER in Render Environment using country code.'
  );
} else {
  startBot().catch(err => {
    console.error('Bot startup error:', err);
  });
}
