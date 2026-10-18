
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser
} from '@whiskeysockets/baileys';

import pino from 'pino';
import express from 'express';

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const PHONE_NUMBER = (process.env.PHONE_NUMBER || '').replace(/\D/g, '');
const OWNER_NUMBER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
const PREFIX = process.env.PREFIX || '.';
const BOT_NAME = process.env.BOT_NAME || 'Cool-boy-xmd';
const AUTH_DIR = process.env.AUTH_DIR || './auth_info_baileys';

const MENU_IMAGE = process.env.MENU_IMAGE ||
  'https://raw.githubusercontent.com/gk8715440-gif/Cool-boy-xmd/main/file_00000000befc7209aec871aa090da284.png';

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });
const startedAt = Date.now();

let sock;
let starting = false;
let stopping = false;
let reconnectTimer;
let pairingRequestedForSocket = false;
let reconnectAttempts = 0;

const groupSettings = new Map();
const warnings = new Map();
// Default mode can be changed in Render Environment with BOT_MODE=public or BOT_MODE=private.
const botSettings = {
  mode: (process.env.BOT_MODE || 'public').toLowerCase() === 'private' ? 'private' : 'public',
  autoread: false
};

app.get('/', (_req, res) => res.send(`${BOT_NAME} is running`));
app.get('/health', (_req, res) => res.json({
  ok: true, bot: BOT_NAME, connected: Boolean(sock?.user), mode: botSettings.mode
}));
app.listen(PORT, '0.0.0.0', () => console.log(`${BOT_NAME} HTTP server on ${PORT}`));

const menu = () => `╭━━━〔 👑 ${BOT_NAME} 〕━━━╮
┃ 🤖 GENERAL
┃ ${PREFIX}menu  ${PREFIX}help  ${PREFIX}ping  ${PREFIX}alive
┃ ${PREFIX}uptime  ${PREFIX}info  ${PREFIX}owner  ${PREFIX}github
┃ ${PREFIX}jid  ${PREFIX}gjid  ${PREFIX}prefix  ${PREFIX}settings
┃
┃ 👥 GROUP
┃ ${PREFIX}groupinfo  ${PREFIX}admins  ${PREFIX}tagall [text]
┃ ${PREFIX}hidetag [text]  ${PREFIX}kick @user
┃ ${PREFIX}promote @user  ${PREFIX}demote @user
┃ ${PREFIX}open  ${PREFIX}close  ${PREFIX}setname [name]
┃ ${PREFIX}setdesc [text]  ${PREFIX}delete (reply)
┃ ${PREFIX}antilink on/off  ${PREFIX}welcome on/off
┃ ${PREFIX}goodbye on/off  ${PREFIX}warn @user
┃ ${PREFIX}warns @user  ${PREFIX}resetwarn @user
┃
┃ ⚙️ OWNER
┃ ${PREFIX}mode public/private  ${PREFIX}autoread on/off
┃ ${PREFIX}restart
┃
┃ 🎵 MEDIA / AI / STICKER
┃ ${PREFIX}play  ${PREFIX}song  ${PREFIX}fb  ${PREFIX}insta
┃ ${PREFIX}tiktok  ${PREFIX}video  ${PREFIX}pinterest
┃ ${PREFIX}gpt  ${PREFIX}sticker  ${PREFIX}toimg  ${PREFIX}weather
╰━━━━━━━━━━━━━━━━━━━━━━╯
Mode: ${botSettings.mode.toUpperCase()} | Prefix: ${PREFIX}

⚠️ Media/AI commands need separate integrations; see bot replies.`;

function textOf(message) {
  const m = message?.message;
  return m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    m?.documentMessage?.caption ||
    m?.buttonsResponseMessage?.selectedButtonId ||
    m?.listResponseMessage?.singleSelectReply?.selectedRowId || '';
}
const numberOf = jid => (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
const isGroup = jid => Boolean(jid?.endsWith('@g.us'));
const owner = jid => Boolean(OWNER_NUMBER) && numberOf(jid) === OWNER_NUMBER;

function uptime() {
  let s = Math.floor((Date.now() - startedAt) / 1000);
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}
function settings(jid) {
  if (!groupSettings.has(jid)) {
    groupSettings.set(jid, { antilink: false, welcome: false, goodbye: false });
  }
  return groupSettings.get(jid);
}
async function sendMenu(jid, quoted) {
  try {
    await sock.sendMessage(jid, { image: { url: MENU_IMAGE }, caption: menu() }, { quoted });
  } catch (e) {
    console.error('Menu image failed:', e?.message || e);
    await sock.sendMessage(jid, { text: menu() }, { quoted });
  }
}
async function groupAdmin(jid, sender) {
  const g = await sock.groupMetadata(jid);
  const p = g.participants.find(x => jidNormalizedUser(x.id) === jidNormalizedUser(sender));
  return Boolean(p?.admin);
}
async function botAdmin(jid) {
  const g = await sock.groupMetadata(jid);
  const me = jidNormalizedUser(sock.user?.id || '');
  const p = g.participants.find(x => jidNormalizedUser(x.id) === me);
  return Boolean(p?.admin);
}
const mentionsOf = m => m?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
const contextOf = m => m?.message?.extendedTextMessage?.contextInfo;

async function runCommand(m) {
  if (!m?.message || !m.key?.remoteJid || m.key.fromMe) return;
  const jid = m.key.remoteJid;
  if (jid === 'status@broadcast') return;
  const sender = m.key.participant || jid;
  const body = textOf(m).trim();
  if (!body.startsWith(PREFIX)) return;

  const tokens = body.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = (tokens.shift() || '').toLowerCase();
  const arg = tokens.join(' ');
  if (!cmd) return;

  const reply = t => sock.sendMessage(jid, { text: t }, { quoted: m });
  const groupOnly = async () => {
    if (!isGroup(jid)) { await reply('❌ এই কমান্ড শুধু গ্রুপে কাজ করে।'); return false; }
    return true;
  };
  const adminOnly = async () => {
    if (!(await groupOnly())) return false;
    if (!owner(sender) && !(await groupAdmin(jid, sender))) {
      await reply('❌ এই কমান্ডের জন্য গ্রুপ অ্যাডমিন হতে হবে।');
      return false;
    }
    return true;
  };

  // Allow basic help and the Owner's mode command in either mode.
  const alwaysAllowed = ['menu', 'help', 'ping', 'alive', 'owner', 'github', 'uptime', 'info', 'mode'];
  if (botSettings.mode === 'private' && !owner(sender) && !alwaysAllowed.includes(cmd)) {
    return reply('🔒 Bot এখন Private Mode-এ আছে। শুধু Owner কমান্ড ব্যবহার করতে পারবে।');
  }

  try {
    switch (cmd) {
      case 'menu': case 'help': case 'gmenu': case 'funmenu':
        await sendMenu(jid, m); return;
      case 'ping': return reply('🏓 Pong! Bot is online.');
      case 'alive': return reply(`✅ ${BOT_NAME} is running\n⏱️ ${uptime()}\nMode: ${botSettings.mode}`);
      case 'uptime': return reply(`⏱️ ${uptime()}`);
      case 'info': return reply(`🤖 ${BOT_NAME}\nPrefix: ${PREFIX}\nMode: ${botSettings.mode}\nUptime: ${uptime()}`);
      case 'owner': return reply(OWNER_NUMBER ? `👑 Owner: +${OWNER_NUMBER}` : 'OWNER_NUMBER Render Environment-এ সেট করা নেই।');
      case 'github': return reply('https://github.com/gk8715440-gif/Cool-boy-xmd');
      case 'prefix': return reply(`Prefix: ${PREFIX}`);
      case 'jid': case 'mee': return reply(`JID: ${sender}\nNumber: ${numberOf(sender)}`);
      case 'gjid': return reply(isGroup(jid) ? `Group JID: ${jid}` : 'এটি গ্রুপ চ্যাট নয়।');
      case 'settings': {
        const s = isGroup(jid) ? settings(jid) : null;
        return reply(`Mode: ${botSettings.mode}\nAuto-read: ${botSettings.autoread ? 'ON' : 'OFF'}` +
          (s ? `\nAnti-link: ${s.antilink ? 'ON' : 'OFF'}\nWelcome: ${s.welcome ? 'ON' : 'OFF'}\nGoodbye: ${s.goodbye ? 'ON' : 'OFF'}` : ''));
      }

      // OWNER-ONLY PUBLIC/PRIVATE SWITCH:
      case 'mode': {
        if (!owner(sender)) {
          return reply('❌ এই কমান্ড শুধু Owner ব্যবহার করতে পারবে।');
        }
        const requestedMode = (tokens[0] || '').toLowerCase();
        if (!['public', 'private'].includes(requestedMode)) {
          return reply(
            '⚙️ Bot Mode\n\n' +
            '.mode public — সবাই বট ব্যবহার করতে পারবে\n' +
            '.mode private — শুধু Owner বট ব্যবহার করতে পারবে\n' +
            `বর্তমান Mode: ${botSettings.mode}`
          );
        }
        botSettings.mode = requestedMode;
        return reply(
          requestedMode === 'public'
            ? '✅ Public Mode চালু হয়েছে। এখন সবাই বটের কমান্ড ব্যবহার করতে পারবে।'
            : '🔒 Private Mode চালু হয়েছে। এখন শুধু Owner বটের কমান্ড ব্যবহার করতে পারবে।'
        );
      }

      case 'autoread': {
        if (!owner(sender)) return reply('❌ শুধু Owner ব্যবহার করতে পারবেন।');
        const v = (tokens[0] || '').toLowerCase();
        if (!['on', 'off'].includes(v)) return reply('ব্যবহার: .autoread on/off');
        botSettings.autoread = v === 'on';
        return reply(`✅ Autoread: ${v}`);
      }
      case 'groupinfo': {
        if (!(await groupOnly())) return;
        const g = await sock.groupMetadata(jid);
        return reply(`📋 ${g.subject}\n👥 Members: ${g.participants.length}\n🆔 ${jid}`);
      }
      case 'admins': {
        if (!(await groupOnly())) return;
        const g = await sock.groupMetadata(jid);
        const list = g.participants.filter(p => p.admin);
        return sock.sendMessage(jid, {
          text: '👑 Group Admins:\n' + list.map(p => `@${numberOf(p.id)}`).join('\n'),
          mentions: list.map(p => p.id)
        }, { quoted: m });
      }
      case 'tagall': case 'tag': case 'hidetag': {
        if (!(await adminOnly())) return;
        const g = await sock.groupMetadata(jid);
        const all = g.participants.map(p => p.id);
        const names = all.map(x => `@${numberOf(x)}`).join(' ');
        const messageText = cmd === 'hidetag' ? (arg || '📢 Attention everyone!') : `${arg || '📢 Attention everyone!'}\n${names}`;
        return sock.sendMessage(jid, { text: messageText, mentions: all }, { quoted: m });
      }
      case 'kick': case 'promote': case 'demote': {
        if (!(await adminOnly())) return;
        if (!(await botAdmin(jid))) return reply('❌ Bot-কে আগে গ্রুপ Admin বানাও।');
        const target = mentionsOf(m);
        if (!target.length) return reply(`ব্যবহার: ${PREFIX}${cmd} @user`);
        await sock.groupParticipantsUpdate(jid, target, cmd === 'kick' ? 'remove' : cmd);
        return reply(`✅ ${cmd} কমান্ডের অনুরোধ পাঠানো হয়েছে।`);
      }
      case 'open': case 'close': {
        if (!(await adminOnly())) return;
        if (!(await botAdmin(jid))) return reply('❌ Bot-কে আগে গ্রুপ Admin বানাও।');
        await sock.groupSettingUpdate(jid, cmd === 'open' ? 'not_announcement' : 'announcement');
        return reply(cmd === 'open' ? '🔓 গ্রুপ সবার জন্য খোলা হয়েছে।' : '🔒 শুধু Admin-রা মেসেজ করতে পারবেন।');
      }
      case 'setname': {
        if (!(await adminOnly())) return;
        if (!arg) return reply(`ব্যবহার: ${PREFIX}setname নতুন নাম`);
        await sock.groupUpdateSubject(jid, arg);
        return reply('✅ গ্রুপের নাম আপডেট হয়েছে।');
      }
      case 'setdesc': {
        if (!(await adminOnly())) return;
        if (!arg) return reply(`ব্যবহার: ${PREFIX}setdesc নতুন বিবরণ`);
        await sock.groupUpdateDescription(jid, arg);
        return reply('✅ গ্রুপের বিবরণ আপডেট হয়েছে।');
      }
      case 'antilink': case 'welcome': case 'goodbye': {
        if (!(await adminOnly())) return;
        const v = (tokens[0] || '').toLowerCase();
        const s = settings(jid);
        if (!['on', 'off'].includes(v)) return reply(`${cmd}: ${s[cmd] ? 'ON' : 'OFF'}\nব্যবহার: ${PREFIX}${cmd} on/off`);
        s[cmd] = v === 'on';
        return reply(`✅ ${cmd}: ${v}\nনোট: এই সেটিংগুলো RAM-এ থাকে; restart হলে reset হবে।`);
      }
      case 'delete': case 'del': {
        if (!(await adminOnly())) return;
        if (!(await botAdmin(jid))) return reply('❌ Bot-কে গ্রুপ Admin বানাও।');
        const q = contextOf(m);
        if (!q?.stanzaId || !q?.participant) return reply('যে মেসেজ মুছবে সেটিতে Reply করে .delete লেখো।');
        return sock.sendMessage(jid, { delete: { remoteJid: jid, fromMe: false, id: q.stanzaId, participant: q.participant } });
      }
      case 'warn': case 'warns': case 'resetwarn': {
        if (!(await adminOnly())) return;
        const target = mentionsOf(m)[0];
        if (!target) return reply(`ব্যবহার: ${PREFIX}${cmd} @user`);
        const key = `${jid}:${target}`;
        if (cmd === 'resetwarn') { warnings.delete(key); return reply('✅ Warning reset হয়েছে।'); }
        if (cmd === 'warn') {
          const n = (warnings.get(key) || 0) + 1;
          warnings.set(key, n);
          return sock.sendMessage(jid, { text: `⚠️ @${numberOf(target)} warning count: ${n}`, mentions: [target] }, { quoted: m });
        }
        return reply(`⚠️ Warning count: ${warnings.get(key) || 0}`);
      }
      case 'gstatus': {
        if (!(await groupOnly())) return;
        const g = await sock.groupMetadata(jid);
        return reply(`Group: ${g.subject}\nMembers: ${g.participants.length}\nAdmins: ${g.participants.filter(p => p.admin).length}`);
      }
      case 'restart':
        if (!owner(sender)) return reply('❌ শুধু Owner ব্যবহার করতে পারবেন।');
        return reply('Render Dashboard থেকে service restart করো।');
      case 'kickall': return reply('নিরাপত্তার জন্য bulk kick চালু করা হয়নি; .kick @user ব্যবহার করো।');
      case 'play': case 'song': case 'lyrics': case 'spotify': case 'fb': case 'insta':
      case 'tiktok': case 'ytmp4': case 'video': case 'pinterest': case 'gpt':
      case 'image': case 'weather': case 'sticker': case 'toimg': case 'tomp4':
      case 'brat': case 'circle': case 'take': case 'fancy': case 'styletext':
      case 'emojimix': case 'tts': case 'vnote': case 'getpp': case 'getbio': case 'vv': case 'vv2':
        return reply(`⚠️ ${PREFIX}${cmd} কমান্ডটির জন্য আলাদা API বা feature integration দরকার; সেটি এই ফাইলে কনফিগার করা নেই।`);
      default: return reply(`❓ অজানা কমান্ড: ${PREFIX}${cmd}\nসব কমান্ড দেখতে ${PREFIX}menu লেখো।`);
    }
  } catch (e) {
    console.error(`Command ${cmd} failed:`, e?.stack || e);
    return reply(`❌ কমান্ড চালানো যায়নি: ${e?.message || 'Unknown error'}`);
  }
}

async function handleMessages(messages, type) {
  if (type !== 'notify') return;
  for (const m of messages || []) {
    try {
      if (botSettings.autoread && m.key?.remoteJid) await sock.readMessages([m.key]);
      const body = textOf(m).trim();
      const jid = m.key?.remoteJid;
      if (jid && isGroup(jid) && body && !m.key?.fromMe) {
        const s = settings(jid);
        const participant = m.key.participant;
        if (s.antilink && /https?:\/\/|www\.|chat\.whatsapp\.com\/|t\.me\//i.test(body) &&
            !body.startsWith(PREFIX) && participant &&
            !(await groupAdmin(jid, participant)) && await botAdmin(jid)) {
          await sock.sendMessage(jid, { delete: { remoteJid: jid, fromMe: false, id: m.key.id, participant } });
          continue;
        }
      }
      await runCommand(m);
    } catch (e) {
      console.error('Message handler error:', e?.message || e);
    }
  }
}

async function startBot() {
  if (starting || stopping) return;
  starting = true;
  clearTimeout(reconnectTimer);
  try {
    if (!PHONE_NUMBER) console.error('Set PHONE_NUMBER in Render Environment: country code + number, digits only.');
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log('Baileys Web version:', version.join('.'), 'isLatest:', isLatest);

    const currentSock = makeWASocket({
      version, auth: state, logger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000
    });
    sock = currentSock;
    pairingRequestedForSocket = false;
    currentSock.ev.on('creds.update', saveCreds);

    currentSock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {
      if ((connection === 'connecting' || qr) && !state.creds.registered && PHONE_NUMBER && !pairingRequestedForSocket) {
        pairingRequestedForSocket = true;
        try {
          const code = await currentSock.requestPairingCode(PHONE_NUMBER);
          console.log('📱 WhatsApp Pairing Code:', code);
          console.log('WhatsApp > Linked devices > Link a device > Link with phone number instead');
        } catch (e) {
          pairingRequestedForSocket = false;
          console.error('Pairing code request failed:', e?.stack || e);
        }
      }
      if (connection === 'open') {
        reconnectAttempts = 0;
        pairingRequestedForSocket = false;
        console.log('✅ WhatsApp connected!');
      }
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.error('WhatsApp disconnected:', statusCode ?? 'unknown', lastDisconnect?.error?.message || '');
        if (stopping || currentSock !== sock) return;
        if (statusCode === DisconnectReason.loggedOut) {
          console.error('Logged out (401): stopping automatic retry. Check session/account and pairing status.');
          return;
        }
        reconnectAttempts += 1;
        const delay = statusCode === DisconnectReason.restartRequired ? 1000 : Math.min(5000 * reconnectAttempts, 30000);
        console.log(`Reconnecting in ${delay}ms...`);
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => { if (!stopping) startBot(); }, delay);
      }
    });
    currentSock.ev.on('messages.upsert', ({ messages, type }) => {
      handleMessages(messages, type).catch(e => console.error('Message event failed:', e?.message || e));
    });
  } catch (e) {
    console.error('Bot startup failed:', e?.stack || e);
    reconnectAttempts += 1;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => { if (!stopping) startBot(); }, Math.min(5000 * reconnectAttempts, 30000));
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
