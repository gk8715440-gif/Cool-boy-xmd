
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';

import pino from 'pino';
import express from 'express';

const app = express();
const PORT = Number(process.env.PORT) || 10000;

const PHONE_NUMBER = (process.env.PHONE_NUMBER || '').replace(/\D/g, '');
const OWNER_NUMBER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');

const PREFIX = '.';
const BOT_NAME = 'Cool-boy-xmd';
const AUTH_DIR = './auth_info_baileys';

const MENU_IMAGE =
  'https://raw.githubusercontent.com/gk8715440-gif/Cool-boy-xmd/main/file_00000000befc7209aec871aa090da284.png';

const logger = pino({ level: 'silent' });
let sock;
let reconnectTimer;
let starting = false;
let pairingRequested = false;

const startTime = Date.now();

const menuText = `
╭━━━〔 ${BOT_NAME} 〕━━━╮
┃ 👑 OWNER MENU
┃ .owner
┃ .alive
┃ .uptime
┃
┃ 🤖 TOOLS
┃ .menu
┃ .help
┃ .ping
┃ .github
┃
┃ 👥 GROUP MENU
┃ .groupinfo
┃ .admins
┃ .tagall [message]
┃ .kick @user
┃ .promote @user
┃ .demote @user
┃ .open
┃ .close
╰━━━━━━━━━━━━━━━━━━╯
`;

app.get('/', (_req, res) => {
  res.send(`${BOT_NAME} bot is running!`);
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', bot: BOT_NAME });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`${BOT_NAME} server running on port ${PORT}`);
});

async function sendMenu(jid) {
  try {
    await sock.sendMessage(jid, {
      image: { url: MENU_IMAGE },
      caption: menuText
    });
  } catch (error) {
    console.error('Menu image error:', error.message);
    await sock.sendMessage(jid, { text: menuText });
  }
}

async function isGroupAdmin(jid, sender) {
  const group = await sock.groupMetadata(jid);
  const participant = group.participants.find(p => p.id === sender);
  return Boolean(participant?.admin);
}

async function processCommand(message) {
  if (!message.message || !message.key.remoteJid) return;
  if (message.key.fromMe) return;

  const jid = message.key.remoteJid;
  const sender = message.key.participant || jid;
  const content = message.message;

  let body = '';

  if (content.conversation) {
    body = content.conversation;
  } else if (content.extendedTextMessage?.text) {
    body = content.extendedTextMessage.text;
  } else if (content.imageMessage?.caption) {
    body = content.imageMessage.caption;
  } else if (content.videoMessage?.caption) {
    body = content.videoMessage.caption;
  }

  body = body.trim();
  if (!body.startsWith(PREFIX)) return;

  const parts = body.slice(PREFIX.length).trim().split(/\s+/);
  const command = (parts.shift() || '').toLowerCase();
  const text = parts.join(' ');

  const reply = async (text) => {
    await sock.sendMessage(jid, { text }, { quoted: message });
  };

  try {
    switch (command) {
      case 'menu':
      case 'help':
      case 'gmenu':
      case 'funmenu':
        await sendMenu(jid);
        break;

      case 'ping':
        await reply('🏓 Pong! Cool-boy-xmd is online.');
        break;

      case 'alive':
        await reply(`✅ ${BOT_NAME} is running!`);
        break;

      case 'owner':
        await reply(
          OWNER_NUMBER
            ? `👑 Owner: ${OWNER_NUMBER}`
            : 'OWNER_NUMBER Render Environment-এ সেট করা নেই।'
        );
        break;

      case 'github':
        await reply('https://github.com/gk8715440-gif/Cool-boy-xmd');
        break;

      case 'uptime': {
        const total = Math.floor((Date.now() - startTime) / 1000);
        const days = Math.floor(total / 86400);
        const hours = Math.floor((total % 86400) / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;

        await reply(
          `⏱️ Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s`
        );
        break;
      }

      case 'groupinfo': {
        if (!jid.endsWith('@g.us')) {
          await reply('এই কমান্ডটি শুধু গ্রুপে ব্যবহার করা যাবে।');
          break;
        }

        const group = await sock.groupMetadata(jid);
        await reply(
          `👥 Group: ${group.subject}\n` +
          `👤 Members: ${group.participants.length}\n` +
          `🆔 ID: ${jid}`
        );
        break;
      }

      case 'admins': {
        if (!jid.endsWith('@g.us')) {
          await reply('এই কমান্ডটি শুধু গ্রুপে ব্যবহার করা যাবে।');
          break;
        }

        const group = await sock.groupMetadata(jid);
        const admins = group.participants.filter(p => p.admin);

        await sock.sendMessage(jid, {
          text:
            '👑 Group Admins:\n' +
            (admins.map(p => `@${p.id.split('@')[0]}`).join('\n') ||
              'No admins found'),
          mentions: admins.map(p => p.id)
        });
        break;
      }

      case 'tagall': {
        if (!jid.endsWith('@g.us')) {
          await reply('এই কমান্ডটি শুধু গ্রুপে ব্যবহার করা যাবে।');
          break;
        }

        if (!(await isGroupAdmin(jid, sender))) {
          await reply('❌ গ্রুপ অ্যাডমিন অনুমতি প্রয়োজন।');
          break;
        }

        const group = await sock.groupMetadata(jid);
        const mentions = group.participants.map(p => p.id);
        const names = mentions.map(id => `@${id.split('@')[0]}`).join(' ');

        await sock.sendMessage(jid, {
          text: `📢 ${text || 'Attention everyone!'}\n\n${names}`,
          mentions
        });
        break;
      }

      case 'kick':
      case 'promote':
      case 'demote': {
        if (!jid.endsWith('@g.us')) {
          await reply('এই কমান্ডটি শুধু গ্রুপে ব্যবহার করা যাবে।');
          break;
        }

        if (!(await isGroupAdmin(jid, sender))) {
          await reply('❌ গ্রুপ অ্যাডমিন অনুমতি প্রয়োজন।');
          break;
        }

        const targets =
          content.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (!targets.length) {
          await reply(`ব্যবহার: .${command} @user`);
          break;
        }

        const action =
          command === 'kick' ? 'remove' :
          command === 'promote' ? 'promote' : 'demote';

        await sock.groupParticipantsUpdate(jid, targets, action);
        await reply(`✅ ${command} অনুরোধ পাঠানো হয়েছে।`);
        break;
      }

      case 'open':
      case 'close': {
        if (!jid.endsWith('@g.us')) {
          await reply('এই কমান্ডটি শুধু গ্রুপে ব্যবহার করা যাবে।');
          break;
        }

        if (!(await isGroupAdmin(jid, sender))) {
          await reply('❌ গ্রুপ অ্যাডমিন অনুমতি প্রয়োজন।');
          break;
        }

        await sock.groupSettingUpdate(
          jid,
          command === 'open' ? 'not_announcement' : 'announcement'
        );

        await reply(
          command === 'open'
            ? '🔓 গ্রুপ খোলা হয়েছে।'
            : '🔒 গ্রুপ বন্ধ করা হয়েছে।'
        );
        break;
      }

      default:
        await reply(`❓ অজানা কমান্ড: .${command}\n.menu লিখে মেনু দেখো।`);
    }
  } catch (error) {
    console.error('Command error:', error.message);
    await reply(`❌ কমান্ড চালানো যায়নি: ${error.message}`);
  }
}

async function startBot() {
  if (starting) return;
  starting = true;

  try {
    const { state, saveCreds } =
      await useMultiFileAuthState(AUTH_DIR);

    const { version } = await fetchLatestBaileysVersion();
    console.log('WhatsApp Web version:', version.join('.'));

    sock = makeWASocket({
      version,
      auth: state,
      logger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (
        qr &&
        !state.creds.registered &&
        PHONE_NUMBER &&
        !pairingRequested
      ) {
        pairingRequested = true;

        try {
          const code = await sock.requestPairingCode(PHONE_NUMBER);
          console.log('📱 WhatsApp Pairing Code:', code);
          console.log('WhatsApp > Linked devices > Link with phone number');
        } catch (error) {
          pairingRequested = false;
          console.error('Pairing code error:', error.message);
        }
      }

      if (!PHONE_NUMBER && !state.creds.registered) {
        console.error('Render Environment-এ PHONE_NUMBER সেট করা নেই।');
      }

      if (connection === 'open') {
        console.log('✅ WhatsApp connected successfully!');
        pairingRequested = false;
      }

      if (connection === 'close') {
        const statusCode =
          lastDisconnect?.error?.output?.statusCode;

        console.error('WhatsApp disconnected. Status:', statusCode);
        console.error(
          lastDisconnect?.error?.message || 'Unknown disconnect reason'
        );

        starting = false;

        if (statusCode === DisconnectReason.loggedOut) {
          console.error('WhatsApp logged out. আবার লিংক করতে হবে।');
          return;
        }

        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          pairingRequested = false;
          startBot();
        }, 5000);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const message of messages) {
        await processCommand(message);
      }
    });
  } catch (error) {
    console.error('Startup error:', error.message);
    starting = false;

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(startBot, 10000);
  }
}

process.on('SIGTERM', () => {
  clearTimeout(reconnectTimer);
  process.exit(0);
});

startBot();