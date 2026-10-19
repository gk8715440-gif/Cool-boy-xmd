
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
const PORT = process.env.PORT || 3000;
const logger = pino({ level: 'silent' });

let sock;
let reconnecting = false;
let stopping = false;
let reconnectTimer;

const groupSettings = new Map();
const AUTH_FOLDER = './auth_info';

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

function getNumber(jid) {
  return (jid || '').split('@')[0].replace(/\D/g, '');
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

  return participant?.admin === 'admin' ||
    participant?.admin === 'superadmin';
}

async function isBotAdmin(groupId) {
  const metadata = await getGroupInfo(groupId);
  const botJid = jidNormalizedUser(sock.user.id);

  const participant = metadata.participants.find(
    p => jidNormalizedUser(p.id) === botJid
  );

  return participant?.admin === 'admin' ||
    participant?.admin === 'superadmin';
}

const processCommand = createCommandHandler({
  getSock: () => sock,
  groupSettings
});

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
            'WhatsApp logged out. Auth session নতুন করে Pair করতে হবে।'
          );
          return;
        }

        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(startBot, 5000);
      }
    });

    if (!state.creds.registered) {
      if (!PHONE_NUMBER) {
        console.log(
          'Render Environment-এ PHONE_NUMBER সেট করো।'
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

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const message of messages) {
        try {
          if (!message.message) continue;

          const sender = message.key.remoteJid;
          if (!sender || sender === 'status@broadcast') continue;

          const text = getText(message.message);

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

process.on('SIGTERM', async () => {
  stopping = true;
  clearTimeout(reconnectTimer);
  console.log('Shutting down bot...');

  try {
    if (sock) sock.end(undefined);
  } catch (error) {
    console.error('Shutdown error:', error.message);
  }

  process.exit(0);
});

process.on('SIGINT', async () => {
  stopping = true;
  clearTimeout(reconnectTimer);

  try {
    if (sock) sock.end(undefined);
  } catch (error) {
    console.error(error.message);
  }

  process.exit(0);
});

startBot();
