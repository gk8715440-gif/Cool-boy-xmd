import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser
} from '@whiskeysockets/baileys';
import pino from 'pino';
import express from 'express';
import qrcode from 'qrcode-terminal';
import OpenAI from 'openai';
import { rm } from 'node:fs/promises';

// ================= CONFIG =================
const app = express();
const PORT = Number(process.env.PORT) || 10000;
const PHONE = (process.env.PHONE_NUMBER || '').replace(/\D/g, '');
const OWNER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
const PREFIX = process.env.PREFIX || '.';
const NAME = process.env.BOT_NAME || 'Cool-boy-xmd';
const AUTH = process.env.AUTH_DIR || './auth_info_baileys';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';

const logger = pino({ level: 'silent' });
const openai = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

let sock;
let starting = false;
let retries = 0;
let reconnectTimer;
let pairingRequested = false;
let resettingAuth = false;

const startedAt = Date.now();
let mode = 'public';
let autoread = false;

const groupSettings = new Map();
const warnings = new Map();

// ================= SERVER =================
app.get('/', (_req, res) => {
  res.send(`${NAME} is running!`);
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    connected: Boolean(sock?.user),
    bot: NAME
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// ================= HELPERS =================
const numberOf = jid =>
  (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');

const isGroup = jid => Boolean(jid?.endsWith('@g.us'));

const isOwner = jid =>
  Boolean(OWNER && numberOf(jid) === OWNER);

const uptime = () => {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);

  return `${Math.floor(seconds / 86400)}d ${
    Math.floor((seconds % 86400) / 3600)
  }h ${Math.floor((seconds % 3600) / 60)}m ${
    seconds % 60
  }s`;
};

function getSettings(jid) {
  if (!groupSettings.has(jid)) {
    groupSettings.set(jid, {
      antilink: false,
      welcome: false,
      goodbye: false
    });
  }

  return groupSettings.get(jid);
}

function getText(m) {
  const message = m?.message;

  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    ''
  ).trim();
}

function menu() {
  return `
╭━━〔 👑 ${NAME} 〕━━╮
┃ GENERAL
┃ .menu .help .ping .alive
┃ .uptime .info .owner .github
┃ .jid .gjid .settings
┃
┃ OWNER
┃ .mode public/private
┃ .autoread on/off
┃
┃ GROUP ADMIN
┃ .groupinfo .admins .tagall .hidetag
┃ .kick @user .promote @user .demote @user
┃ .open .close .setname text .setdesc text
┃ .delete .antilink on/off .welcome on/off
┃ .goodbye on/off .warn @user .warns @user
┃ .resetwarn @user
┃
┃ API FEATURES
┃ .gpt প্রশ্ন/লেখা
┃ .weather শহরের নাম
┃ .play/.song/.fb/.insta/.tiktok/.video
┃ .sticker/.toimg (API/feature দরকার)
╰━━━━━━━━━━━━━━━━━━╯
Mode: ${mode.toUpperCase()}`;
}

async function isAdmin(jid, user) {
  const metadata = await sock.groupMetadata(jid);

  const participant = metadata.participants.find(
    p => jidNormalizedUser(p.id) === jidNormalizedUser(user)
  );

  return Boolean(participant?.admin);
}

async function botIsAdmin(jid) {
  const metadata = await sock.groupMetadata(jid);
  const myJid = jidNormalizedUser(sock.user?.id || '');

  const participant = metadata.participants.find(
    p => jidNormalizedUser(p.id) === myJid
  );

  return Boolean(participant?.admin);
}

// ================= GPT =================
async function askGPT(prompt) {
  if (!openai) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const result = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful WhatsApp assistant. Reply in the language used by the user.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7
  });

  return (
    result.choices?.[0]?.message?.content?.trim() ||
    'কোনো উত্তর পাওয়া যায়নি।'
  );
}

// ================= WEATHER =================
async function getWeather(city) {
  if (!WEATHER_API_KEY) {
    throw new Error('OPENWEATHER_API_KEY is not configured');
  }

  if (!city) {
    throw new Error('শহরের নাম লিখুন');
  }

  const url = new URL(
    'https://api.openweathermap.org/data/2.5/weather'
  );

  url.search = new URLSearchParams({
    q: city,
    appid: WEATHER_API_KEY,
    units: 'metric',
    lang: 'bn'
  }).toString();

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'Weather API request failed');
  }

  return `🌦️ ${data.name}
${data.weather?.[0]?.description || 'আবহাওয়ার তথ্য'}
🌡️ তাপমাত্রা: ${data.main?.temp}°C
🤔 অনুভূত: ${data.main?.feels_like}°C
💧 আর্দ্রতা: ${data.main?.humidity}%
💨 বাতাস: ${data.wind?.speed} m/s`;
}

// ================= COMMANDS =================
async function handleCommand(m) {
  if (!m?.message || !m.key?.remoteJid || m.key.fromMe) {
    return;
  }

  const jid = m.key.remoteJid;

  if (jid === 'status@broadcast') {
    return;
  }

  const sender = m.key.participant || jid;
  const body = getText(m);

  if (!body.startsWith(PREFIX)) {
    return;
  }

  const parts = body
    .slice(PREFIX.length)
    .trim()
    .split(/\s+/);

  const cmd = (parts.shift() || '').toLowerCase();
  const args = parts;
  const text = args.join(' ');

  if (!cmd) {
    return;
  }

  const reply = message =>
    sock.sendMessage(
      jid,
      { text: message },
      { quoted: m }
    );

  const groupOnly = async () => {
    if (!isGroup(jid)) {
      await reply('❌ এই কমান্ড শুধু গ্রুপে কাজ করে।');
      return false;
    }

    return true;
  };

  const adminOnly = async () => {
    if (!(await groupOnly())) {
      return false;
    }

    if (!isOwner(sender) && !(await isAdmin(jid, sender))) {
      await reply('❌ এই কমান্ডের জন্য গ্রুপ Admin হতে হবে।');
      return false;
    }

    return true;
  };

  const ownerOnly = async () => {
    if (!isOwner(sender)) {
      await reply('❌ শুধু Owner এই কমান্ড ব্যবহার করতে পারবে।');
      return false;
    }

    return true;
  };

  const allowed = [
    'menu',
    'help',
    'gmenu',
    'funmenu',
    'ping',
    'alive',
    'uptime',
    'info',
    'owner',
    'github',
    'mode'
  ];

  if (
    mode === 'private' &&
    !isOwner(sender) &&
    !allowed.includes(cmd)
  ) {
    return reply('🔒 Bot Private Mode-এ আছে।');
  }

  try {
    switch (cmd) {
      case 'menu':
      case 'help':
      case 'gmenu':
      case 'funmenu':
        return reply(menu());

      case 'ping':
        return reply('🏓 Pong! Bot online.');

      case 'alive':
        return reply(`✅ ${NAME} is running!\n⏱️ ${uptime()}`);

      case 'uptime':
        return reply(`⏱️ ${uptime()}`);

      case 'info':
        return reply(
          `${NAME}\nPrefix: ${PREFIX}\nMode: ${mode}`
        );

      case 'owner':
        return reply(
          OWNER
            ? `👑 Owner: +${OWNER}`
            : 'OWNER_NUMBER সেট করো।'
        );

      case 'github':
        return reply(
          'https://github.com/gk8715440-gif/Cool-boy-xmd'
        );

      case 'jid':
        return reply(
          `JID: ${sender}\nNumber: ${numberOf(sender)}`
        );

      case 'gjid':
        return reply(
          isGroup(jid) ? jid : 'এটি গ্রুপ চ্যাট নয়।'
        );

      case 'settings': {
        const settings = isGroup(jid)
          ? getSettings(jid)
          : null;

        return reply(
          `Mode: ${mode}\nAuto-read: ${
            autoread ? 'ON' : 'OFF'
          }` +
          (
            settings
              ? `\nAnti-link: ${
                  settings.antilink ? 'ON' : 'OFF'
                }\nWelcome: ${
                  settings.welcome ? 'ON' : 'OFF'
                }\nGoodbye: ${
                  settings.goodbye ? 'ON' : 'OFF'
                }`
              : ''
          )
        );
      }

      case 'mode':
        if (!(await ownerOnly())) return;

        if (!['public', 'private'].includes(args[0])) {
          return reply(
            'ব্যবহার: .mode public অথবা .mode private'
          );
        }

        mode = args[0];
        return reply(`✅ Mode: ${mode}`);

      case 'autoread':
        if (!(await ownerOnly())) return;

        if (!['on', 'off'].includes(args[0])) {
          return reply('ব্যবহার: .autoread on/off');
        }

        autoread = args[0] === 'on';
        return reply(`✅ Auto-read: ${args[0]}`);

      case 'gpt':
        if (!text) {
          return reply(`ব্যবহার: ${PREFIX}gpt তোমার প্রশ্ন`);
        }

        try {
          return reply(await askGPT(text));
        } catch (e) {
          console.error('GPT error:', e?.message || e);

          return reply(
            '❌ GPT চালু হয়নি। OPENAI_API_KEY এবং API billing/limit পরীক্ষা করো।'
          );
        }

      case 'weather':
        try {
          return reply(await getWeather(text));
        } catch (e) {
          console.error('Weather error:', e?.message || e);

          return reply(
            '❌ আবহাওয়ার তথ্য পাওয়া যায়নি। শহরের নাম এবং OPENWEATHER_API_KEY পরীক্ষা করো।'
          );
        }

      case 'groupinfo': {
        if (!(await groupOnly())) return;

        const g = await sock.groupMetadata(jid);

        return reply(
          `📋 ${g.subject}\nMembers: ${g.participants.length}`
        );
      }

      case 'admins': {
        if (!(await groupOnly())) return;

        const g = await sock.groupMetadata(jid);
        const admins = g.participants.filter(p => p.admin);

        return sock.sendMessage(
          jid,
          {
            text:
              '👑 Admins:\n' +
              admins.map(p => `@${numberOf(p.id)}`).join('\n'),
            mentions: admins.map(p => p.id)
          },
          { quoted: m }
        );
      }

      case 'tagall':
      case 'hidetag': {
        if (!(await adminOnly())) return;

        const g = await sock.groupMetadata(jid);
        const members = g.participants.map(p => p.id);
        const tags = members
          .map(p => `@${numberOf(p)}`)
          .join(' ');

        return sock.sendMessage(
          jid,
          {
            text:
              cmd === 'hidetag'
                ? (text || '📢 Attention everyone!')
                : `${text || '📢 Attention everyone!'}\n${tags}`,
            mentions: members
          },
          { quoted: m }
        );
      }

      case 'kick':
      case 'promote':
      case 'demote': {
        if (!(await adminOnly())) return;

        if (!(await botIsAdmin(jid))) {
          return reply('❌ Bot-কে প্রথমে গ্রুপ Admin বানাও।');
        }

        const targets =
          m.message?.extendedTextMessage?.contextInfo
            ?.mentionedJid || [];

        if (!targets.length) {
          return reply(`ব্যবহার: ${PREFIX}${cmd} @user`);
        }

        const action = {
          kick: 'remove',
          promote: 'promote',
          demote: 'demote'
        }[cmd];

        await sock.groupParticipantsUpdate(
          jid,
          targets,
          action
        );

        return reply('✅ Group command সম্পন্ন হয়েছে।');
      }

      case 'open':
      case 'close': {
        if (!(await adminOnly())) return;

        if (!(await botIsAdmin(jid))) {
          return reply('❌ Bot-কে গ্রুপ Admin বানাও।');
        }

        await sock.groupSettingUpdate(
          jid,
          cmd === 'open'
            ? 'not_announcement'
            : 'announcement'
        );

        return reply(
          cmd === 'open'
            ? '🔓 Group opened.'
            : '🔒 Group closed.'
        );
      }

      case 'setname':
      case 'setdesc': {
        if (!(await adminOnly())) return;

        if (!(await botIsAdmin(jid))) {
          return reply('❌ Bot-কে গ্রুপ Admin বানাও।');
        }

        if (!text) {
          return reply(`ব্যবহার: ${PREFIX}${cmd} নতুন লেখা`);
        }

        if (cmd === 'setname') {
          await sock.groupUpdateSubject(jid, text);
        } else {
          await sock.groupUpdateDescription(jid, text);
        }

        return reply('✅ Group updated.');
      }

      case 'antilink':
      case 'welcome':
      case 'goodbye': {
        if (!(await adminOnly())) return;

        if (!['on', 'off'].includes(args[0])) {
          return reply(`ব্যবহার: ${PREFIX}${cmd} on/off`);
        }

        getSettings(jid)[cmd] = args[0] === 'on';

        return reply(`✅ ${cmd}: ${args[0]}`);
      }

      case 'delete':
      case 'del': {
        if (!(await adminOnly())) return;

        if (!(await botIsAdmin(jid))) {
          return reply('❌ Bot-কে গ্রুপ Admin বানাও।');
        }

        const quoted =
          m.message?.extendedTextMessage?.contextInfo;

        if (!quoted?.stanzaId || !quoted?.participant) {
          return reply(
            'কোনো মেসেজে Reply করে .delete লেখো।'
          );
        }

        return sock.sendMessage(jid, {
          delete: {
            remoteJid: jid,
            fromMe: false,
            id: quoted.stanzaId,
            participant: quoted.participant
          }
        });
      }

      case 'warn':
      case 'warns':
      case 'resetwarn': {
        if (!(await adminOnly())) return;

        const target =
          m.message?.extendedTextMessage?.contextInfo
            ?.mentionedJid?.[0];

        if (!target) {
          return reply(`ব্যবহার: ${PREFIX}${cmd} @user`);
        }

        const key = `${jid}:${target}`;

        if (cmd === 'resetwarn') {
          warnings.delete(key);
          return reply('✅ Warning reset হয়েছে।');
        }

        if (cmd === 'warns') {
          return reply(
            `Warnings: ${warnings.get(key) || 0}`
          );
        }

        const count = (warnings.get(key) || 0) + 1;
        warnings.set(key, count);

        return sock.sendMessage(
          jid,
          {
            text: `⚠️ @${numberOf(target)} warning: ${count}`,
            mentions: [target]
          },
          { quoted: m }
        );
      }

      case 'restart':
        if (!(await ownerOnly())) return;

        return reply(
          'Render Dashboard থেকে Restart service চাপো।'
        );

      case 'play':
      case 'song':
      case 'fb':
      case 'insta':
      case 'tiktok':
      case 'video':
      case 'pinterest':
      case 'sticker':
      case 'toimg':
        return reply(
          `⚠️ .${cmd} চালাতে নির্ভরযোগ্য সংশ্লিষ্ট API বা media-processing feature যোগ করতে হবে। এই ফাইলে ভুয়া API endpoint রাখা হয়নি।`
        );

      default:
        return reply(
          `❓ Unknown command: ${PREFIX}${cmd}\n${PREFIX}menu লেখো।`
        );
    }
  } catch (error) {
    console.error(
      `Command ${cmd}:`,
      error?.stack || error
    );

    return reply(
      '❌ কমান্ড চালানো যায়নি। Bot admin ও সেটিংস পরীক্ষা করো।'
    );
  }
}

// ================= MESSAGE HANDLER =================
async function handleMessages(messages, type) {
  if (type !== 'notify') return;

  for (const m of messages || []) {
    try {
      if (!m?.message || m.key?.fromMe) continue;

      const jid = m.key?.remoteJid;

      if (!jid || jid === 'status@broadcast') continue;

      if (autoread) {
        try {
          await sock.readMessages([m.key]);
        } catch {}
      }

      const body = getText(m);

      if (isGroup(jid) && body) {
        const settings = getSettings(jid);
        const sender = m.key.participant;

        if (
          settings.antilink &&
          /https?:\/\/|www\.|chat\.whatsapp\.com\/|t\.me\//i.test(body) &&
          sender &&
          !isOwner(sender) &&
          !(await isAdmin(jid, sender)) &&
          await botIsAdmin(jid)
        ) {
          await sock.sendMessage(jid, {
            delete: m.key
          });

          continue;
        }
      }

      await handleCommand(m);
    } catch (error) {
      console.error(
        'Message error:',
        error?.stack || error
      );
    }
  }
}

// ================= START BOT =================
async function startBot() {
  if (starting) return;

  starting = true;
  clearTimeout(reconnectTimer);

  try {
    if (!PHONE || PHONE.length < 10) {
      console.error(
        'PHONE_NUMBER ঠিক করো: country code-সহ শুধু সংখ্যা দিতে হবে।'
      );

      return;
    }

    console.log('Starting Baileys...');
    console.log(
      'Phone number configured:',
      `...${PHONE.slice(-4)}`
    );

    const { state, saveCreds } =
      await useMultiFileAuthState(AUTH);

    const { version } =
      await fetchLatestBaileysVersion();

    const currentSock = makeWASocket({
      version,
      auth: state,
      logger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000
    });

    sock = currentSock;

    let closed = false;

    currentSock.ev.on('creds.update', saveCreds);

    currentSock.ev.on(
      'messages.upsert',
      ({ messages, type }) => {
        void handleMessages(messages, type);
      }
    );

    currentSock.ev.on(
      'connection.update',
      async update => {
        const {
          connection,
          lastDisconnect,
          qr
        } = update;

        if (
          qr &&
          !state.creds.registered &&
          !closed &&
          currentSock === sock
        ) {
          console.log(
            '\nScan this QR with WhatsApp > Linked devices > Link a device:'
          );

          qrcode.generate(qr, { small: true });
        }

        if (
          !state.creds.registered &&
          !pairingRequested &&
          !closed &&
          currentSock === sock
        ) {
          pairingRequested = true;

          try {
            const code =
              await currentSock.requestPairingCode(PHONE);

            console.log(
              'WHATSAPP PAIRING CODE:',
              code
            );

            console.log(
              'WhatsApp > Linked devices > Link a device > Link with phone number instead'
            );
          } catch (error) {
            pairingRequested = false;

            console.error(
              'Pairing code failed:',
              error?.message || error
            );
          }
        }

        if (connection === 'open') {
          closed = false;
          retries = 0;
          pairingRequested = false;

          console.log(
            'WhatsApp connected successfully!'
          );
        }

        if (connection === 'close') {
          closed = true;
          pairingRequested = false;

          const code =
            lastDisconnect?.error?.output?.statusCode;

          console.error(
            'WhatsApp disconnected:',
            code || 'unknown'
          );

          if (currentSock !== sock) return;

          if (code === DisconnectReason.loggedOut) {
            if (resettingAuth) return;

            resettingAuth = true;

            console.error(
              'Session logged out. Clearing old auth session...'
            );

            try {
              await rm(AUTH, {
                recursive: