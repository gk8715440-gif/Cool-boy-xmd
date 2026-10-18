
import * as baileys from '@whiskeysockets/baileys';

const makeWASocket = baileys.default || baileys.makeWASocket;
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser
} = baileys;
import pino from 'pino';
import express from 'express';

// CONFIG
const app = express();
const PORT = Number(process.env.PORT) || 10000;
const PHONE = (process.env.PHONE_NUMBER || '').replace(/\D/g, '');
const OWNER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
const PREFIX = process.env.PREFIX || '.';
const NAME = process.env.BOT_NAME || 'Cool-boy-xmd';
const AUTH = process.env.AUTH_DIR || './auth_info_baileys_v2';
const logger = pino({ level: 'silent' });

let sock;
let starting = false;
let stopping = false;
let reconnectTimer;
let retries = 0;
let pairingRequested = false;

const startedAt = Date.now();
const config = {
  mode: (process.env.BOT_MODE || 'public').toLowerCase() === 'private'
    ? 'private' : 'public',
  autoread: false
};

const groups = new Map();
const warnings = new Map();

app.get('/', (_, res) => res.send(`${NAME} is running!`));
app.get('/health', (_, res) =>
  res.json({ ok: true, connected: !!sock?.user, mode: config.mode })
);
app.listen(PORT, '0.0.0.0', () => console.log(`Server on ${PORT}`));

const num = jid =>
  (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
const isGroup = jid => Boolean(jid?.endsWith('@g.us'));
const isOwner = jid => Boolean(OWNER && num(jid) === OWNER);

const uptime = () => {
  let s = Math.floor((Date.now() - startedAt) / 1000);
  const d = Math.floor(s / 86400);
  s %= 86400;
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  return `${d}d ${h}h ${m}m ${s % 60}s`;
};

const getGroupSettings = jid => {
  if (!groups.has(jid)) {
    groups.set(jid, {
      antilink: false,
      welcome: false,
      goodbye: false
    });
  }
  return groups.get(jid);
};

const getText = m => {
  const x = m?.message;
  return (
    x?.conversation ||
    x?.extendedTextMessage?.text ||
    x?.imageMessage?.caption ||
    x?.videoMessage?.caption ||
    x?.documentMessage?.caption ||
    ''
  ).trim();
};

const menu = () => `
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
┃ .groupinfo .admins .tagall
┃ .hidetag .kick @user
┃ .promote @user .demote @user
┃ .open .close .setname
┃ .setdesc .delete
┃ .antilink on/off
┃ .welcome on/off .goodbye on/off
┃ .warn @user .warns @user
┃ .resetwarn @user
┃
┃ MEDIA / AI
┃ .play .song .fb .insta
┃ .tiktok .video .gpt
┃ .sticker .toimg .weather
╰━━━━━━━━━━━━━━━━━━╯
Mode: ${config.mode.toUpperCase()}
`;

async function isAdmin(jid, user) {
  const g = await sock.groupMetadata(jid);
  const p = g.participants.find(
    x => jidNormalizedUser(x.id) === jidNormalizedUser(user)
  );
  return Boolean(p?.admin);
}

async function botIsAdmin(jid) {
  const g = await sock.groupMetadata(jid);
  const me = jidNormalizedUser(sock.user?.id || '');
  return Boolean(g.participants.find(
    x => jidNormalizedUser(x.id) === me
  )?.admin);
}

async function handleCommand(m) {
  if (!m?.message || !m.key?.remoteJid || m.key.fromMe) return;

  const jid = m.key.remoteJid;
  if (jid === 'status@broadcast') return;

  const sender = m.key.participant || jid;
  const body = getText(m);
  if (!body.startsWith(PREFIX)) return;

  const args = body.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = (args.shift() || '').toLowerCase();
  const text = args.join(' ');
  if (!cmd) return;

  const reply = t =>
    sock.sendMessage(jid, { text: t }, { quoted: m });

  const groupOnly = async () => {
    if (!isGroup(jid)) {
      await reply('❌ এই কমান্ড শুধু গ্রুপে কাজ করে।');
      return false;
    }
    return true;
  };

  const adminOnly = async () => {
    if (!(await groupOnly())) return false;
    if (!isOwner(sender) && !(await isAdmin(jid, sender))) {
      await reply('❌ গ্রুপ অ্যাডমিন হতে হবে।');
      return false;
    }
    return true;
  };

  const allowed = [
    'menu', 'help', 'ping', 'alive', 'uptime',
    'info', 'owner', 'github', 'mode'
  ];

  if (config.mode === 'private' &&
      !isOwner(sender) && !allowed.includes(cmd)) {
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
        return reply(`✅ ${NAME} is running\n⏱️ ${uptime()}`);

      case 'uptime':
        return reply(`⏱️ ${uptime()}`);

      case 'info':
        return reply(`${NAME}\nPrefix: ${PREFIX}\nMode: ${config.mode}`);

      case 'owner':
        return reply(OWNER ? `👑 Owner: +${OWNER}` : 'OWNER_NUMBER সেট করো।');

      case 'github':
        return reply('https://github.com/gk8715440-gif/Cool-boy-xmd');

      case 'jid':
        return reply(`JID: ${sender}\nNumber: ${num(sender)}`);

      case 'gjid':
        return reply(isGroup(jid) ? jid : 'এটি গ্রুপ চ্যাট নয়।');

      case 'settings': {
        const s = isGroup(jid) ? getGroupSettings(jid) : null;
        return reply(
          `Mode: ${config.mode}\nAuto-read: ${config.autoread ? 'ON' : 'OFF'}` +
          (s ? `\nAnti-link: ${s.antilink ? 'ON' : 'OFF'}` +
          `\nWelcome: ${s.welcome ? 'ON' : 'OFF'}` +
          `\nGoodbye: ${s.goodbye ? 'ON' : 'OFF'}` : '')
        );
      }

      case 'mode':
        if (!isOwner(sender)) return reply('❌ শুধু Owner পারবে।');
        if (!['public', 'private'].includes(args[0])) {
          return reply('ব্যবহার: .mode public অথবা .mode private');
        }
        config.mode = args[0];
        return reply(`✅ Mode: ${config.mode}`);

      case 'autoread':
        if (!isOwner(sender)) return reply('❌ শুধু Owner পারবে।');
        if (!['on', 'off'].includes(args[0])) {
          return reply('ব্যবহার: .autoread on/off');
        }
        config.autoread = args[0] === 'on';
        return reply(`✅ Auto-read: ${args[0]}`);

      case 'groupinfo': {
        if (!(await groupOnly())) return;
        const g = await sock.groupMetadata(jid);
        return reply(`📋 ${g.subject}\nMembers: ${g.participants.length}`);
      }

      case 'admins': {
        if (!(await groupOnly())) return;
        const g = await sock.groupMetadata(jid);
        const a = g.participants.filter(p => p.admin);
        return sock.sendMessage(jid, {
          text: '👑 Admins:\n' + a.map(p => `@${num(p.id)}`).join('\n'),
          mentions: a.map(p => p.id)
        }, { quoted: m });
      }

      case 'tagall':
      case 'hidetag': {
        if (!(await adminOnly())) return;
        const g = await sock.groupMetadata(jid);
        const all = g.participants.map(p => p.id);
        const tags = all.map(p => `@${num(p)}`).join(' ');
        return sock.sendMessage(jid, {
          text: cmd === 'hidetag'
            ? (text || '📢 Attention everyone!')
            : `${text || '📢 Attention everyone!'}\n${tags}`,
          mentions: all
        }, { quoted: m });
      }

      case 'kick':
      case 'promote':
      case 'demote': {
        if (!(await adminOnly())) return;
        if (!(await botIsAdmin(jid))) {
          return reply('❌ Bot-কে গ্রুপ Admin বানাও।');
        }
        const targets =
          m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (!targets.length) return reply(`ব্যবহার: ${PREFIX}${cmd} @user`);
        await sock.groupParticipantsUpdate(
          jid, targets, cmd === 'kick' ? 'remove' : cmd
        );
        return reply('✅ Group command সম্পন্ন হয়েছে।');
      }

      case 'open':
      case 'close':
        if (!(await adminOnly())) return;
        if (!(await botIsAdmin(jid))) {
          return reply('❌ Bot-কে গ্রুপ Admin বানাও।');
        }
        await sock.groupSettingUpdate(
          jid, cmd === 'open' ? 'not_announcement' : 'announcement'
        );
        return reply(cmd === 'open' ? '🔓 Group opened.' : '🔒 Group closed.');

      case 'setname':
      case 'setdesc':
        if (!(await adminOnly())) return;
        if (!(await botIsAdmin(jid))) {
          return reply('❌ Bot-কে গ্রুপ Admin বানাও।');
        }
        if (!text) return reply(`ব্যবহার: ${PREFIX}${cmd} নতুন লেখা`);
        if (cmd === 'setname') await sock.groupUpdateSubject(jid, text);
        else await sock.groupUpdateDescription(jid, text);
        return reply('✅ Group updated.');

      case 'antilink':
      case 'welcome':
      case 'goodbye': {
        if (!(await adminOnly())) return;
        if (!['on', 'off'].includes(args[0])) {
          return reply(`ব্যবহার: ${PREFIX}${cmd} on/off`);
        }
        getGroupSettings(jid)[cmd] = args[0] === 'on';
        return reply(`✅ ${cmd}: ${args[0]}`);
      }

      case 'delete':
      case 'del': {
        if (!(await adminOnly())) return;
        if (!(await botIsAdmin(jid))) {
          return reply('❌ Bot-কে গ্রুপ Admin বানাও।');
        }
        const q = m.message?.extendedTextMessage?.contextInfo;
        if (!q?.stanzaId || !q?.participant) {
          return reply('মেসেজে Reply করে .delete লেখো।');
        }
        return sock.sendMessage(jid, {
          delete: {
            remoteJid: jid,
            fromMe: false,
            id: q.stanzaId,
            participant: q.participant
          }
        });
      }

      case 'warn':
      case 'warns':
      case 'resetwarn': {
        if (!(await adminOnly())) return;
        const target =
          m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!target) return reply(`ব্যবহার: ${PREFIX}${cmd} @user`);
        const key = `${jid}:${target}`;
        if (cmd === 'resetwarn') {
          warnings.delete(key);
          return reply('✅ Warning reset হয়েছে।');
        }
        if (cmd === 'warns') {
          return reply(`Warnings: ${warnings.get(key) || 0}`);
        }
        const n = (warnings.get(key) || 0) + 1;
        warnings.set(key, n);
        return sock.sendMessage(jid, {
          text: `⚠️ @${num(target)} warning: ${n}`,
          mentions: [target]
        }, { quoted: m });
      }

      case 'restart':
        if (!isOwner(sender)) return reply('❌ শুধু Owner পারবে।');
        return reply('Render Dashboard থেকে Restart service চাপো।');

      case 'play':
      case 'song':
      case 'fb':
      case 'insta':
      case 'tiktok':
      case 'video':
      case 'pinterest':
      case 'gpt':
      case 'sticker':
      case 'toimg':
      case 'weather':
        return reply(`⚠️ .${cmd} চালাতে আলাদা API/feature যোগ করতে হবে।`);

      default:
        return reply(`❓ Unknown command: ${PREFIX}${cmd}\n${PREFIX}menu লেখো।`);
    }
  } catch (e) {
    console.error(`Command ${cmd}:`, e?.message || e);
    return reply('❌ কমান্ড চালানো যায়নি। Bot admin ও সেটিংস পরীক্ষা করো।');
  }
}

async function handleMessages(messages, type) {
  if (type !== 'notify') return;

  for (const m of messages || []) {
    try {
      if (!m?.message || m.key?.fromMe) continue;

      const jid = m.key?.remoteJid;
      if (!jid || jid === 'status@broadcast') continue;

      if (config.autoread) {
        try { await sock.readMessages([m.key]); } catch {}
      }

      const body = getText(m);

      if (isGroup(jid) && body && !body.startsWith(PREFIX)) {
        const s = getGroupSettings(jid);
        const sender = m.key.participant;

        if (
          s.antilink &&
          /https?:\/\/|www\.|chat\.whatsapp\.com\/|t\.me\//i.test(body) &&
          sender &&
          !(await isOwner(sender)) &&
          !(await isAdmin(jid, sender)) &&
          await botIsAdmin(jid)
        ) {
          await sock.sendMessage(jid, { delete: m.key });
          continue;
        }
      }

      await handleCommand(m);
    } catch (e) {
      console.error('Message error:', e?.message || e);
    }
  }
}

async function startBot() {
  if (starting || stopping) return;
  starting = true;
  clearTimeout(reconnectTimer);

  try {
    if (!PHONE) {
      console.error('Render Environment-এ PHONE_NUMBER সেট করো।');
      return;
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH);
    const { version } = await fetchLatestBaileysVersion();

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
    let pairingTimer;

    currentSock.ev.on('creds.update', saveCreds);

    if (!state.creds.registered) {
      pairingTimer = setTimeout(async () => {
        if (closed || stopping || currentSock !== sock || pairingRequested) return;

        pairingRequested = true;
        try {
          const code = await currentSock.requestPairingCode(PHONE);
          console.log('📱 WHATSAPP PAIRING CODE:', code);
          console.log('WhatsApp > Linked devices > Link a device > Link with phone number instead');
        } catch (e) {
          pairingRequested = false;
          console.error('Pairing code failed:', e?.message || e);
        }
      }, 5000);
    }

    currentSock.ev.on('messages.upsert', ({ messages, type }) => {
      handleMessages(messages, type);
    });

    currentSock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        clearTimeout(pairingTimer);
        retries = 0;
        pairingRequested = false;
        console.log('✅ WhatsApp connected!');
      }

      if (connection === 'close') {
        closed = true;
        clearTimeout(pairingTimer);
        const code = lastDisconnect?.error?.output?.statusCode;
        console.error('WhatsApp disconnected:', code || 'unknown');

        if (stopping || currentSock !== sock) return;
        if (code === DisconnectReason.loggedOut) {
          console.error('401 Logged out: session আবার pair করতে হবে।');
          return;
        }

        retries++;
        const delay = code === DisconnectReason.restartRequired
          ? 1000 : Math.min(retries * 5000, 30000);

        console.log(`Reconnecting in ${delay}ms`);
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          if (!stopping) startBot();
        }, delay);
      }
    });
  } catch (e) {
    console.error('Bot startup error:', e?.stack || e);
    retries++;
    reconnectTimer = setTimeout(
      () => { if (!stopping) startBot(); },
      Math.min(retries * 5000, 30000)
    );
  } finally {
    starting = false;
  }
}

function shutdown() {
  stopping = true;
  clearTimeout(reconnectTimer);
  try { sock?.end(undefined); } catch {}
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startBot();
