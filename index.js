
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys';

import pino from 'pino';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

const PHONE_NUMBER = (process.env.PHONE_NUMBER || '').replace(/\D/g, '');
const OWNER_NUMBER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
const MENU_IMAGE = process.env.MENU_IMAGE || '';

const PREFIX = '.';
const START_TIME = Date.now();

const logger = pino({ level: 'silent' });

let sock;
let reconnecting = false;

// ==============================
// WEB SERVER
// ==============================

app.get('/', (req, res) => {
  res.send('Cool-boy-xmd WhatsApp Bot is running!');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    bot: 'Cool-boy-xmd'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web server running on port ${PORT}`);
});

// ==============================
// HELPERS
// ==============================

function getText(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.buttonsResponseMessage?.selectedButtonId ||
    message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  );
}

function getUptime() {
  const seconds = Math.floor((Date.now() - START_TIME) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;

  return `${hours}h ${minutes}m ${remaining}s`;
}

function getMenu() {
  return `╭━━━〔 COOL BOY XMD 〕━━━╮
┃
┃ 🤖 WhatsApp Bot Menu
┃
┃ GENERAL
┃ ${PREFIX}menu
┃ ${PREFIX}help
┃ ${PREFIX}ping
┃ ${PREFIX}alive
┃ ${PREFIX}uptime
┃ ${PREFIX}owner
┃ ${PREFIX}github
┃
┃ GROUP MANAGEMENT
┃ ${PREFIX}tagall
┃ ${PREFIX}kick @mention
┃ ${PREFIX}promote @mention
┃ ${PREFIX}demote @mention
┃
┃ MEDIA / AI
┃ .song (integration required)
┃ .play (integration required)
┃ .video (integration required)
┃ .sticker (not implemented)
┃ .gpt (AI integration required)
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

Prefix: ${PREFIX}
Bot: Cool-boy-xmd`;
}

// ==============================
// COMMAND HANDLER
// ==============================

async function processCommand(sender, messageText, message) {
  const text = messageText.trim();

  if (!text.startsWith(PREFIX)) return;

  const parts = text.slice(PREFIX.length).trim().split(/\s+/);
  const command = (parts.shift() || '').toLowerCase();

  const args = parts;
  const isGroup = sender.endsWith('@g.us');
  const senderNumber = (message.key.participant || sender)
    .split('@')[0]
    .replace(/\D/g, '');

  const isOwner =
    OWNER_NUMBER !== '' && senderNumber === OWNER_NUMBER;

  const reply = async (text) => {
    await sock.sendMessage(
      sender,
      { text },
      { quoted: message }
    );
  };

  // GENERAL COMMANDS

  if (command === 'menu' || command === 'help') {
    if (MENU_IMAGE.startsWith('https://') ||
        MENU_IMAGE.startsWith('http://')) {
      try {
        await sock.sendMessage(
          sender,
          {
            image: { url: MENU_IMAGE },
            caption: getMenu()
          },
          { quoted: message }
        );
      } catch {
        await reply(getMenu());
      }
    } else {
      await reply(getMenu());
    }
    return;
  }

  if (command === 'ping') {
    await reply('🏓 Pong! Cool-boy-xmd is running.');
    return;
  }

  if (command === 'alive') {
    await reply(
      `✅ Cool-boy-xmd is alive!\n⏱️ Uptime: ${getUptime()}`
    );
    return;
  }

  if (command === 'uptime') {
    await reply(`⏱️ Bot uptime: ${getUptime()}`);
    return;
  }

  if (command === 'owner') {
    await reply(
      OWNER_NUMBER
        ? `👑 Owner: +${OWNER_NUMBER}`
        : 'Owner number is not configured in Render.'
    );
    return;
  }

  if (command === 'github') {
    await reply(
      'GitHub repository:\nhttps://github.com/gk8715440-gif/Cool-boy-xmd'
    );
    return;
  }

  // GROUP COMMANDS

  if (['tagall', 'kick', 'promote', 'demote'].includes(command)) {
    if (!isGroup) {
      await reply('❌ এই কমান্ড শুধু গ্রুপে ব্যবহার করা যাবে।');
      return;
    }

    if (!isOwner) {
      const metadata = await sock.groupMetadata(sender);
      const participant = metadata.participants.find(
        p => p.id === (message.key.participant || sender)
      );

      const isAdmin =
        participant?.admin === 'admin' ||
        participant?.admin === 'superadmin';

      if (!isAdmin) {
        await reply('❌ এই কমান্ড ব্যবহার করতে গ্রুপ অ্যাডমিন হতে হবে।');
        return;
      }
    }

    const mentioned =
      message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (command === 'tagall') {
      const metadata = await sock.groupMetadata(sender);
      const mentions = metadata.participants.map(p => p.id);

      const body = args.join(' ') || 'Group members';

      await sock.sendMessage(sender, {
        text:
          `📢 ${body}\n\n` +
          mentions.map(jid => `@${jid.split('@')[0]}`).join('\n'),
        mentions
      });
      return;
    }

    if (mentioned.length === 0) {
      await reply(`ব্যবহার: .${command} @mention`);
      return;
    }

    if (command === 'kick') {
      await sock.groupParticipantsUpdate(sender, mentioned, 'remove');
      await reply('✅ সদস্য সরানোর অনুরোধ পাঠানো হয়েছে।');
      return;
    }

    if (command === 'promote') {
      await sock.groupParticipantsUpdate(sender, mentioned, 'promote');
      await reply('✅ সদস্যকে অ্যাডমিন করার অনুরোধ পাঠানো হয়েছে।');
      return;
    }

    if (command === 'demote') {
      await sock.groupParticipantsUpdate(sender, mentioned, 'demote');
      await reply('✅ অ্যাডমিন পদ সরানোর অনুরোধ পাঠানো হয়েছে।');
      return;
    }
  }

  // COMMANDS THAT NEED MORE INTEGRATION

  const extraCommands = [
    'song', 'play', 'gan', 'spotify', 'fb', 'insta',
    'tiktok', 'ytmp4', 'pinterest', 'video', 'gpt',
    'apk', 'spam', 'sudo', 'sticker', 'image'
  ];

  if (extraCommands.includes(command)) {
    await reply(
      `⚠️ .${command} কমান্ডটি তালিকায় আছে, কিন্তু এটি চালানোর জন্য অতিরিক্ত ফিচার/API সেটআপ প্রয়োজন।`
    );
    return;
  }
}

// ==============================
// START WHATSAPP BOT
// ==============================

async function startBot() {
  if (reconnecting) return;
  reconnecting = true;

  try {
    const { state, saveCreds } =
      await useMultiFileAuthState('./auth_info_baileys');

    sock = makeWASocket({
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '120.0.0'],
      markOnlineOnConnect: false,
      syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'connecting') {
        console.log('Connecting to WhatsApp...');
      }

      if (connection === 'open') {
        console.log('✅ WhatsApp connected successfully!');
      }

      if (connection === 'close') {
        const statusCode =
          lastDisconnect?.error?.output?.statusCode;

        console.log('WhatsApp disconnected. Status:', statusCode);

        if (statusCode !== DisconnectReason.loggedOut) {
          console.log('Reconnecting in 5 seconds...');
          setTimeout(() => {
            reconnecting = false;
            startBot();
          }, 5000);
        } else {
          console.log(
            'WhatsApp logged out. Re-pairing may be required.'
          );
          reconnecting = false;
        }
      }
    });

    // Pairing code for a new WhatsApp connection
    if (!state.creds.registered) {
      if (!PHONE_NUMBER) {
        console.log(
          'Set PHONE_NUMBER in Render Environment Variables.'
        );
      } else {
        try {
          await new Promise(resolve => setTimeout(resolve, 3000));

          const code = await sock.requestPairingCode(PHONE_NUMBER);
          console.log('WhatsApp Pairing Code:', code);
          console.log('Enter this code in WhatsApp Linked Devices.');
        } catch (error) {
          console.error('Pairing code error:', error.message);
        }
      }
    }

    // Incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const message of messages) {
        try {
          if (!message.message || message.key.fromMe) continue;

          const sender = message.key.remoteJid;
          if (!sender || sender === 'status@broadcast') continue;

          const text = getText(message.message);
          if (!text) continue;

          await processCommand(sender, text, message);
        } catch (error) {
          console.error('Message handler error:', error.message);
        }
      }
    });

  } catch (error) {
    console.error('Bot startup error:', error);
    setTimeout(() => {
      reconnecting = false;
      startBot();
    }, 10000);
    return;
  }

  reconnecting = false;
}

// ==============================
// SHUTDOWN
// ==============================

process.on('SIGTERM', async () => {
  console.log('Shutting down bot...');
  try {
    if (sock) sock.end(undefined);
  } catch {}
  process.exit(0);
});

startBot();
