
import * as Baileys from '@whiskeysockets/baileys';
import pino from 'pino';
import express from 'express';

import {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser
} from '@whiskeysockets/baileys';

import {
  BOT_NAME,
  PHONE_NUMBER
} from './settings.js';

import { createCommandHandler } from './commands.js';

const makeWASocket =
  Baileys.default?.default ??
  Baileys.default ??
  Baileys.makeWASocket;

if (typeof makeWASocket !== 'function') {
  throw new Error('Baileys makeWASocket export পাওয়া যায়নি।');
}

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const logger = pino({ level: 'silent' });

let sock;
let reconnecting = false;
let stopping = false;
let reconnectTimer;

const groupSettings = new Map();
const AUTH_FOLDER = process.env.AUTH_DIR || './auth_info';

app.get('/', (req, res) => {
  res.send(`${BOT_NAME} WhatsApp Bot is running!`);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    bot: BOT_NAME,
    whatsapp: sock?.user ? 'connected' : 'disconnected'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web server running on port ${PORT}`);
});

function getText(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    message?.buttonsResponseMessage?.selectedButtonId ||
    message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    message?.templateButtonReplyMessage?.selectedId ||
    ''
  );
}

function isLink(text) {
  return /https?:\/\/|www\.|chat\.whatsapp\.com\/|t\.me\//i.test(text);
}

async function getGroupInfo(groupId) {
  return sock.groupMetadata(groupId);
}

async function isGroupAdmin(groupId, participantJid) {
  const metadata = await getGroupInfo(groupId);
  const normalized = jidNormalizedUser(participantJid);

  const participant = metadata.participants.find(
    p => jidNormalizedUser(p.id) === normalized
  );

  return (
    participant?.admin === 'admin' ||
    participant?.admin === 'superadmin'
  );
}

async function isBotAdmin(groupId) {
  const metadata = await getGroupInfo(groupId);
  const botJid = jidNormalizedUser(sock.user.id);

  const participant = metadata.participants.find(
    p => jidNormalizedUser(p.id) === botJid
  );

  return (
    participant?.admin === 'admin' ||
    participant?.admin === 'superadmin'
  );
}

const processCommand = createCommandHandler({
  getSock: () => sock,
  groupSettings
});

// Welcome ও Goodbye আলাদা মেসেজ
async function handleGroupParticipantsUpdate(update) {
  try {
    const { id, participants, action } = update;

    if (!id || !Array.isArray(participants)) return;

    const settings = groupSettings.get(id) || {};

    for (const item of participants) {
      const participant =
        typeof item === 'string' ? item : item?.id;

      if (!participant) continue;

      const number = participant.split('@')[0];

      // Welcome Message
      if (action === 'add' && settings.welcome) {
        await sock.sendMessage(id, {
          text:
            `🌸╭━━━〔 স্বাগতম 〕━━━╮🌸\n\n` +
            `💖 স্বাগতম, @${number}!\n\n` +
            `আমাদের ছোট্ট পরিবারে তোমাকে আন্তরিক স্বাগতম। 🥰\n` +
            `সবার সঙ্গে ভালোভাবে মিশবে এবং গ্রুপের নিয়ম মেনে চলবে।\n\n` +
            `তোমার আগমনে আমরা আনন্দিত। ❤️\n\n` +
            `🌸╰━━━━━━━━━━━━╯🌸`,
          mentions: [participant]
        });
      }

      // Goodbye Message
      if (action === 'remove' && settings.goodbye) {
        await sock.sendMessage(id, {
          text:
            `🥀╭━━━〔 বিদায় 〕━━━╮🥀\n\n` +
            `বিদায়, @${number}!\n\n` +
            `আমাদের গ্রুপে তোমার উপস্থিতি ভালো লাগত।\n` +
            `যেখানেই থাকো, ভালো থেকো এবং সুস্থ থেকো। ❤️\n\n` +
            `তোমার আগামী দিনের জন্য রইল অনেক শুভকামনা।\n` +
            `আবার কোনো একদিন দেখা হবে। 🌷\n\n` +
            `🥀╰━━━━━━━━━━━━╯🥀`,
          mentions: [participant]
        });
      }
    }
  } catch (error) {
    console.error('Welcome/Goodbye error:', error);
  }
}

async function startBot() {
  if (reconnecting || stopping) return;

  reconnecting = true;

  try {
    const { state, saveCreds } =
      await useMultiFileAuthState(AUTH_FOLDER);

    const { version, isLatest } =
      await fetchLatestBaileysVersion();

    console.log(
      'WhatsApp Web version:',
      version.join('.'),
      'Latest:',
      isLatest
    );

    sock = makeWASocket({
      version,
      auth: state,
      logger,
      browser: ['Ubuntu', 'Chrome', '120.0.0'],
      markOnlineOnConnect: false,
      syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    // গ্রুপে কেউ যোগ দিলে বা চলে গেলে
    sock.ev.on(
      'group-participants.update',
      handleGroupParticipantsUpdate
    );

    sock.ev.on('connection.update', async update => {
      const { connection, lastDisconnect } = update;

      if (connection === 'connecting') {
        console.log('Connecting to WhatsApp...');
      }

      if (connection === 'open') {
        console.log('✅ WhatsApp connected!');
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;

        console.log('WhatsApp disconnected:', code);
        console.log('Disconnect details:', lastDisconnect?.error);

        reconnecting = false;
        sock = undefined;

        if (stopping) return;

        if (code === DisconnectReason.loggedOut) {
          console.log(
            'WhatsApp logged out. নতুন করে Pair করতে হবে।'
          );
          return;
        }

        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(startBot, 5000);
      }
    });

    // Pairing Code
    if (!state.creds.registered) {
      if (!PHONE_NUMBER) {
        console.log(
          'Environment Variables-এ PHONE_NUMBER সেট করো।'
        );
      } else {
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));

          const code = await sock.requestPairingCode(PHONE_NUMBER);

          console.log('WhatsApp Pairing Code:', code);
        } catch (error) {
          console.error('Pairing code error:', error.message);
        }
      }
    }

    // Message Handler
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const message of messages) {
        try {
          if (!message.message) continue;

          const sender = message.key.remoteJid;

          if (!sender || sender === 'status@broadcast') continue;

          const text = getText(message.message);

          // Anti-link
          if (
            sender.endsWith('@g.us') &&
            text &&
            isLink(text) &&
            !text.trim().startsWith('.')
          ) {
            const settings = groupSettings.get(sender);
            const participant = message.key.participant;

            if (
              settings?.antilink &&
              participant &&
              !(await isGroupAdmin(sender, participant)) &&
              await isBotAdmin(sender)
            ) {
              await sock.sendMessage(sender, {
                delete: {
                  remoteJid: sender,
                  fromMe: false,
                  id: message.key.id,
                  participant
                }
              });

              continue;
            }
          }

          if (text) {
            await processCommand(sender, text, message);
          }
        } catch (error) {
          console.error('Message handler error:', error);
        }
      }
    });

  } catch (error) {
    console.error('Bot startup error:', error);

    reconnecting = false;

    if (!stopping) {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(startBot, 10000);
    }

    return;
  }

  reconnecting = false;
}

// Graceful Shutdown
async function shutdown() {
  stopping = true;
  clearTimeout(reconnectTimer);

  console.log('Shutting down bot...');

  try {
    if (sock) {
      sock.end(undefined);
    }
  } catch (error) {
    console.error('Shutdown error:', error.message);
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startBot();
