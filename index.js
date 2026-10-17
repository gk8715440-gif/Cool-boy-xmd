
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';

import pino from 'pino';
import express from 'express';

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const AUTH_DIR = './auth_info_baileys';

const PHONE_NUMBER = (process.env.PHONE_NUMBER || '').replace(/\D/g, '');
const OWNER_NUMBER = (process.env.OWNER_NUMBER || PHONE_NUMBER).replace(/\D/g, '');
const BOT_NAME = process.env.BOT_NAME || 'Cool-boy-xmd';
const PREFIX = process.env.PREFIX || '.';

const MENU_IMAGE =
  process.env.MENU_IMAGE ||
  'https://raw.githubusercontent.com/gk8715440-gif/Cool-boy-xmd/main/file_00000000befc7209aec871aa090da284.png';

const logger = pino({ level: 'silent' });

let sock;
let reconnectTimer = null;
let pairingRequested = false;
let starting = false;
let startedAt = Date.now();

const settings = {
  mode: 'public',
  welcome: false,
  goodbye: false,
  antilink: false,
  autoread: false,
  autotyping: false,
  autoreact: false,
  alwaysonline: false
};

const menuText = `
╭━━〔 ${BOT_NAME} 〕━━╮
┃
┃ 🤖 GENERAL
┃ .menu
┃ .help
┃ .ping
┃ .alive
┃ .owner
┃ .uptime
┃ .github
┃ .jid
┃ .info
┃
┃ 👥 GROUP
┃ .groupinfo
┃ .admins
┃ .tagall
┃ .kick
┃ .promote
┃ .demote
┃ .open
┃ .close
┃ .setname
┃ .setdesc
┃ .delete
┃
┃ ⚙️ SETTINGS
┃ .settings
┃ .mode public/private
┃ .welcome on/off
┃ .goodbye on/off
┃ .antilink on/off
┃ .autoread on/off
┃ .autotyping on/off
┃ .autoreact on/off
┃ .alwaysonline on/off
┃
┃ 🎵 MEDIA
┃ .play
┃ .song
┃ .video
┃ .fb
┃ .insta
┃ .sticker
┃ .toimg
╰━━━━━━━━━━━━━━━━╯
⚡ Powered by ${BOT_NAME}
`;

function getText(message) {
  const m = message?.message;
  if (!m) return '';

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  ).trim();
}

function numberOf(jid = '') {
  return jid.split('@')[0].split(':')[0].replace(/\D/g, '');
}

function uptime() {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;
}

function isOwner(sender) {
  return Boolean(OWNER_NUMBER) && numberOf(sender) === OWNER_NUMBER;
}

async function sendText(jid, text, quoted) {
  return sock.sendMessage(
    jid,
    { text },
    quoted ? { quoted } : {}
  );
}

async function groupAdmin(jid, sender) {
  if (!jid.endsWith('@g.us')) return false;

  const metadata = await sock.groupMetadata(jid);
  const participant = metadata.participants.find(
    p => numberOf(p.id) === numberOf(sender)
  );

  return Boolean(participant?.admin);
}

async function botAdmin(jid) {
  const metadata = await sock.groupMetadata(jid);
  const botNumber = numberOf(sock.user?.id || '');

  return metadata.participants.some(
    p => numberOf(p.id) === botNumber && p.admin
  );
}

async function processCommand(message) {
  const jid = message.key.remoteJid;
  const sender = message.key.participant || jid;
  const text = getText(message);

  if (!text.startsWith(PREFIX)) return;

  const parts = text.slice(PREFIX.length).trim().split(/\s+/);
  const command = (parts.shift() || '').toLowerCase();
  const input = parts.join(' ');
  const isGroup = jid.endsWith('@g.us');

  if (settings.mode === 'private' && !isOwner(sender)) return;

  try {
    switch (command) {
      case 'menu':
      case 'help':
      case 'gmenu':
      case 'funmenu': {
        try {
          await sock.sendMessage(
            jid,
            {
              image: { url: MENU_IMAGE },
              caption: menuText
            },
            { quoted: message }
          );
        } catch (error) {
          console.error('Menu image error:', error?.message || error);
          await sendText(jid, menuText, message);
        }
        break;
      }

      case 'ping':
        await sendText(jid, '🏓 Pong! Bot is online.', message);
        break;

      case 'alive':
        await sendText(
          jid,
          `✅ ${BOT_NAME} is running!\nUptime: ${uptime()}`,
          message
        );
        break;

      case 'uptime':
        await sendText(jid, `⏱️ ${uptime()}`, message);
        break;

      case 'owner':
        await sendText(
          jid,
          `👑 Owner: ${OWNER_NUMBER || 'Not configured'}`,
          message
        );
        break;

      case 'github':
        await sendText(
          jid,
          'https://github.com/gk8715440-gif/Cool-boy-xmd',
          message
        );
        break;

      case 'jid':
        await sendText(jid, `Chat: ${jid}\nSender: ${sender}`, message);
        break;

      case 'info':
        await sendText(
          jid,
          `Bot: ${BOT_NAME}\nPrefix: ${PREFIX}\nMode: ${settings.mode}`,
          message
        );
        break;

      case 'settings':
        await sendText(jid, JSON.stringify(settings, null, 2), message);
        break;

      case 'mode': {
        if (!isOwner(sender)) {
          await sendText(jid, '❌ শুধু Owner এই সেটিং বদলাতে পারবেন।', message);
          break;
        }

        const mode = input.toLowerCase();

        if (!['public', 'private'].includes(mode)) {
          await sendText(jid, 'ব্যবহার: .mode public অথবা .mode private', message);
          break;
        }

        settings.mode = mode;
        await sendText(jid, `✅ Mode: ${mode}`, message);
        break;
      }

      case 'welcome':
      case 'goodbye':
      case 'antilink':
      case 'autoread':
      case 'autotyping':
      case 'autoreact':
      case 'alwaysonline': {
        if (!isOwner(sender) && !(isGroup && await groupAdmin(jid, sender))) {
          await sendText(jid, '❌ Owner অথবা Group Admin হতে হবে।', message);
          break;
        }

        const value = input.toLowerCase();

        if (!['on', 'off'].includes(value)) {
          await sendText(jid, `ব্যবহার: ${PREFIX}${command} on/off`, message);
          break;
        }

        settings[command] = value === 'on';
        await sendText(jid, `✅ ${command}: ${value}`, message);
        break;
      }

      case 'groupinfo': {
        if (!isGroup) {
          await sendText(jid, '❌ গ্রুপে ব্যবহার করুন।', message);
          break;
        }

        const metadata = await sock.groupMetadata(jid);

        await sendText(
          jid,
          `👥 Group: ${metadata.subject}\nMembers: ${metadata.participants.length}\nDescription: ${metadata.desc || 'None'}`,
          message
        );
        break;
      }

      case 'admins': {
        if (!isGroup) {
          await sendText(jid, '❌ গ্রুপে ব্যবহার করুন।', message);
          break;
        }

        const metadata = await sock.groupMetadata(jid);
        const admins = metadata.participants.filter(p => p.admin);

        await sock.sendMessage(
          jid,
          {
            text: '👑 Group Admins:\n' +
              admins.map(p => `@${numberOf(p.id)}`).join('\n'),
            mentions: admins.map(p => p.id)
          },
          { quoted: message }
        );
        break;
      }

      case 'tag':
      case 'tagall': {
        if (!isGroup) {
          await sendText(jid, '❌ গ্রুপে ব্যবহার করুন।', message);
          break;
        }

        if (!isOwner(sender) && !(await groupAdmin(jid, sender))) {
          await sendText(jid, '❌ Admin অনুমতি প্রয়োজন।', message);
          break;
        }

        const metadata = await sock.groupMetadata(jid);
        const members = metadata.participants;

        await sock.sendMessage(
          jid,
          {
            text: `${input || '📢 Attention everyone!'}\n\n` +
              members.map(p => `@${numberOf(p.id)}`).join(' '),
            mentions: members.map(p => p.id)
          },
          { quoted: message }
        );
        break;
      }

      case 'kick':
      case 'promote':
      case 'demote': {
        if (!isGroup) {
          await sendText(jid, '❌ গ্রুপে ব্যবহার করুন।', message);
          break;
        }

        if (!isOwner(sender) && !(await groupAdmin(jid, sender))) {
          await sendText(jid, '❌ Admin অনুমতি প্রয়োজন।', message);
          break;
        }

        if (!(await botAdmin(jid))) {
          await sendText(jid, '❌ Bot-কে Group Admin করুন।', message);
          break;
        }

        const context = message.message?.extendedTextMessage?.contextInfo;
        const targets = [
          ...(context?.mentionedJid || []),
          ...(context?.participant ? [context.participant] : [])
        ];

        if (!targets.length) {
          await sendText(
            jid,
            'সদস্যকে মেনশন করুন অথবা তার মেসেজে Reply দিন।',
            message
          );
          break;
        }

        const action = command === 'kick' ? 'remove' : command;

        await sock.groupParticipantsUpdate(
          jid,
          [...new Set(targets)],
          action
        );

        await sendText(jid, `✅ ${command} সম্পন্ন হয়েছে।`, message);
        break;
      }

      case 'open':
      case 'close': {
        if (!isGroup) {
          await sendText(jid, '❌ গ্রুপে ব্যবহার করুন।', message);
          break;
        }

        if (!isOwner(sender) && !(await groupAdmin(jid, sender))) {
          await sendText(jid, '❌ Admin অনুমতি প্রয়োজন।', message);
          break;
        }

        if (!(await botAdmin(jid))) {
          await sendText(jid, '❌ Bot-কে Group Admin করুন।', message);
          break;
        }

        await sock.groupSettingUpdate(
          jid,
          command === 'open' ? 'not_announcement' : 'announcement'
        );

        await sendText(
          jid,
          command === 'open'
            ? '✅ গ্রুপ খোলা হয়েছে।'
            : '🔒 শুধু Admin মেসেজ করতে পারবেন।',
          message
        );
        break;
      }

      case 'setname':
      case 'setdesc': {
        if (!isGroup || !input) {
          await sendText(jid, `ব্যবহার: ${PREFIX}${command} নতুন লেখা`, message);
          break;
        }

        if (!isOwner(sender) && !(await groupAdmin(jid, sender))) {
          await sendText(jid, '❌ Admin অনুমতি প্রয়োজন।', message);
          break;
        }

        if (!(await botAdmin(jid))) {
          await sendText(jid, '❌ Bot-কে Admin করুন।', message);
          break;
        }

        if (command === 'setname') {
          await sock.groupUpdateSubject(jid, input);
        } else {
          await sock.groupUpdateDescription(jid, input);
        }

        await sendText(jid, '✅ পরিবর্তন সম্পন্ন হয়েছে।', message);
        break;
      }

      case 'delete':
      case 'del': {
        if (!isGroup) {
          await sendText(jid, '❌ গ্রুপে ব্যবহার করুন।', message);
          break;
        }

        if (!isOwner(sender) && !(await groupAdmin(jid, sender))) {
          await sendText(jid, '❌ Admin অনুমতি প্রয়োজন।', message);
          break;
        }

        if (!(await botAdmin(jid))) {
          await sendText(jid, '❌ Bot-কে Admin করুন।', message);
          break;
        }

        const context = message.message?.extendedTextMessage?.contextInfo;

        if (!context?.stanzaId || !context?.participant) {
          await sendText(
            jid,
            'যে মেসেজ মুছবেন সেটিতে Reply দিয়ে .delete লিখুন।',
            message
          );
          break;
        }

        await sock.sendMessage(jid, {
          delete: {
            remoteJid: jid,
            fromMe: false,
            id: context.stanzaId,
            participant: context.participant
          }
        });
        break;
      }

      case 'play':
      case 'song':
      case 'video':
      case 'fb':
      case 'insta':
      case 'sticker':
      case 'toimg':
        await sendText(
          jid,
          `⚠️ .${command} ফিচার এখনো যুক্ত করা হয়নি।`,
          message
        );
        break;

      default:
        await sendText(
          jid,
          `❓ অজানা কমান্ড: ${PREFIX}${command}\n.menu লিখুন।`,
          message
        );
    }
  } catch (error) {
    console.error(
      `Command ${command} error:`,
      error?.message || error
    );

    await sendText(
      jid,
      '❌ কমান্ড চালাতে সমস্যা হয়েছে। Render Logs পরীক্ষা করুন।',
      message
    ).catch(() => {});
  }
}

app.get('/', (_req, res) => {
  res.status(200).send(`${BOT_NAME} is running!`);
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    connected: Boolean(sock?.user),
    uptime: uptime()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`${BOT_NAME} server running on port ${PORT}`);
});

async function startBot() {
  if (starting) return;
  starting = true;
  pairingRequested = false;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    console.log('Baileys version:', version.join('.'));

    sock = makeWASocket({
      version,
      auth: state,
      logger,
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000
    });

    sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
      } catch (error) {
        console.error('Save credentials error:', error?.message || error);
      }
    });

    sock.ev.on('connection.update', async update => {
      const { connection, lastDisconnect, qr } = update;

      // Pairing code: request only after the socket emits its QR event.
      if (
        qr &&
        !state.creds.registered &&
        !pairingRequested &&
        PHONE_NUMBER
      ) {
        pairingRequested = true;

        try {
          const code = await sock.requestPairingCode(PHONE_NUMBER);
          console.log('📱 WhatsApp Pairing Code:', code);
          console.log('Enter this code in WhatsApp > Linked devices.');
        } catch (error) {
          pairingRequested = false;
          console.error(
            'Pairing code error:',
            error?.message || error
          );
        }
      }

      if (connection === 'open') {
        console.log('✅ WhatsApp connected successfully.');
        console.log('Logged in:', sock.user?.id || 'unknown');
        return;
      }

      if (connection !== 'close') return;

      const code = lastDisconnect?.error?.output?.statusCode;
      const errorMessage = lastDisconnect?.error?.message || '';

      console.error('WhatsApp disconnected:', code || 'unknown');
      if (errorMessage) console.error('Disconnect details:', errorMessage);

      starting = false;

      if (code === DisconnectReason.loggedOut) {
        console.error(
          '❌ WhatsApp logged out. A new login may be required.'
        );
        return;
      }

      // 515 / restartRequired may happen during a successful login.
      if (reconnectTimer) clearTimeout(reconnectTimer);

      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startBot().catch(error => {
          console.error('Reconnect error:', error?.message || error);
        });
      }, 3000);
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const message of messages) {
        if (!message.message || message.key.fromMe) continue;

        const jid = message.key.remoteJid;

        if (!jid || jid === 'status@broadcast') continue;

        if (settings.autoread) {
          await sock.readMessages([message.key]).catch(() => {});
        }

        if (settings.autotyping) {
          await sock.sendPresenceUpdate('composing', jid).catch(() => {});
        }

        await processCommand(message);
      }
    });

    if (!state.creds.registered && !PHONE_NUMBER) {
      console.error(
        '❌ Render Environment-এ PHONE_NUMBER সেট করুন। Country code-সহ শুধু digits দিন।'
      );
    }
  } catch (error) {
    console.error('Bot startup error:', error?.message || error);
    starting = false;

    if (reconnectTimer) clearTimeout(reconnectTimer);

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      startBot().catch(console.error);
    }, 10000);
  }
}

process.on('SIGTERM', () => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  process.exit(0);
});

startBot().catch(error => {
  console.error('Fatal startup error:', error);
  process.exit(1);
});
