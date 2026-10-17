
import baileys from '@whiskeysockets/baileys';
import pino from 'pino';
import express from 'express';

const makeWASocket =
  baileys.default || baileys.makeWASocket || baileys;

const {
  useMultiFileAuthState,
  DisconnectReason
} = baileys;

const app = express();
const PORT = process.env.PORT || 3000;

const PHONE_NUMBER = (process.env.PHONE_NUMBER || '')
  .replace(/\D/g, '');

const OWNER_NUMBER = (process.env.OWNER_NUMBER || '')
  .replace(/\D/g, '');

const MENU_IMAGE = process.env.MENU_IMAGE || '';
const PREFIX = '.';
const START_TIME = Date.now();

const logger = pino({ level: 'silent' });

let sock;
let pairingRequested = false;
let reconnecting = false;
let starting = false;

app.get('/', (req, res) => {
  res.send('COOL-BOY-XMD WhatsApp Bot is running!');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    whatsapp: sock?.user ? 'connected' : 'disconnected'
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

function getText(msg) {
  let m = msg.message;
  if (!m) return '';

  // Handle common WhatsApp message wrappers.
  m = m.ephemeralMessage?.message || m;
  m = m.viewOnceMessage?.message || m;
  m = m.viewOnceMessageV2?.message || m;

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
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

⚠️ কিছু কমান্ডের হ্যান্ডলার এখনো যোগ করা হয়নি।
Powered by COOL-BOY-XMD`;
}

async function startBot() {
  if (starting) return;
  starting = true;

  try {
    const { state, saveCreds } =
      await useMultiFileAuthState('./auth_info_baileys');

    sock = makeWASocket({
      auth: state,
      logger,
      browser: ['Ubuntu', 'Chrome', '120.0.0'],
      markOnlineOnConnect: false,
      syncFullHistory: false
    });

    const currentSock = sock;

    currentSock.ev.on('creds.update', saveCreds);

    // Only one connection handler.
    currentSock.ev.on(
      'connection.update',
      async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Request a pairing code for an unregistered session.
        if (
          !state.creds.registered &&
          PHONE_NUMBER &&
          !pairingRequested &&
          (qr || connection === 'connecting')
        ) {
          pairingRequested = true;

          try {
            // Allow the socket to initialise first.
            await new Promise(resolve =>
              setTimeout(resolve, 3000)
            );

            if (
              currentSock !== sock ||
              state.creds.registered
            ) {
              return;
            }

            const code =
              await currentSock.requestPairingCode(
                PHONE_NUMBER
              );

            console.log('WhatsApp Pairing Code:', code);
            console.log(
              'WhatsApp → Linked devices → Link with phone number'
            );
          } catch (err) {
            pairingRequested = false;
            console.error(
              'Pairing code error:',
              err.message
            );
          }
        }

        if (connection === 'open') {
          console.log('WhatsApp connected successfully');
          pairingRequested = false;
        }

        if (connection === 'close') {
          const status =
            lastDisconnect?.error?.output?.statusCode;

          console.error(
            'WhatsApp disconnected:',
            status,
            lastDisconnect?.error?.message || ''
          );

          if (currentSock !== sock) return;

          if (status === DisconnectReason.loggedOut) {
            console.error(
              'WhatsApp logged out. Re-link the device.'
            );
            starting = false;
            return;
          }

          if (reconnecting) return;

          reconnecting = true;
          starting = false;

          setTimeout(() => {
            reconnecting = false;
            pairingRequested = false;

            startBot().catch(err => {
              console.error(
                'Restart error:',
                err.message
              );
            });
          }, 5000);
        }
      }
    );

    currentSock.ev.on(
      'messages.upsert',
      async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.message || msg.key.fromMe) continue;

          const jid = msg.key.remoteJid;

          if (
            !jid ||
            jid === 'status@broadcast' ||
            (
              !jid.endsWith('@g.us') &&
              !jid.endsWith('@s.whatsapp.net') &&
              !jid.endsWith('@lid')
            )
          ) {
            continue;
          }

          const body = getText(msg);
          if (!body.startsWith(PREFIX)) continue;

          const args = body
            .slice(PREFIX.length)
            .trim()
            .split(/\s+/);

          const command = (args.shift() || '')
            .toLowerCase();

          try {
            switch (command) {
              case 'menu':
              case 'help': {
                const caption = makeMenu();

                if (MENU_IMAGE) {
                  await currentSock.sendMessage(jid, {
                    image: { url: MENU_IMAGE },
                    caption
                  });
                } else {
                  await currentSock.sendMessage(jid, {
                    text: caption
                  });
                }
                break;
              }

              case 'ping':
                await currentSock.sendMessage(jid, {
                  text: '🏓 Pong!'
                });
                break;

              case 'alive':
                await currentSock.sendMessage(jid, {
                  text: '✅ COOL-BOY-XMD is running!'
                });
                break;

              case 'owner':
                await currentSock.sendMessage(jid, {
                  text: OWNER_NUMBER
                    ? `👑 Owner: ${OWNER_NUMBER}`
                    : 'Owner number is not configured.'
                });
                break;

              case 'uptime':
                await currentSock.sendMessage(jid, {
                  text: `⏱️ Uptime: ${getUptime()}`
                });
                break;

              case 'github':
                await currentSock.sendMessage(jid, {
                  text:
                    'GitHub: https://github.com/gk8715440-gif/Cool-boy-xmd'
                });
                break;

              default:
                await currentSock.sendMessage(jid, {
                  text:
                    `❌ Unknown command: ${PREFIX}${command}\n` +
                    `Type ${PREFIX}menu to see commands.`
                });
            }
          } catch (err) {
            console.error(
              'Command error:',
              err.message
            );
          }
        }
      }
    );
  } catch (err) {
    console.error('Bot startup error:', err.message);
    starting = false;
  }
}

if (!PHONE_NUMBER) {
  console.error(
    'Set PHONE_NUMBER in Render Environment with country code.'
  );
} else {
  startBot().catch(err => {
    starting = false;
    console.error('Bot startup error:', err.message);
  });
}

process.on('SIGTERM', () => {
  console.log('Server shutting down.');
  server.close();
  sock?.end(new Error('Server shutting down'));
});
