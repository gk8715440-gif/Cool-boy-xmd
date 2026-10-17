
import * as Baileys from '@whiskeysockets/baileys';

const makeWASocket =
  Baileys.default?.default ??
  Baileys.default ??
  Baileys.makeWASocket;

const {
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser
} = Baileys;

console.log('Baileys version export check:', {
  defaultType: typeof Baileys.default,
  nestedDefaultType: typeof Baileys.default?.default,
  namedType: typeof Baileys.makeWASocket,
  selectedType: typeof makeWASocket
});
import pino from 'pino';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

const PHONE_NUMBER = (process.env.PHONE_NUMBER || '').replace(/\D/g, '');
const OWNER_NUMBER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');

const PREFIX = '.';
const BOT_NAME = 'Cool-boy-xmd';

// YOUR MENU IMAGE LINK
const MENU_IMAGE =
  'https://raw.githubusercontent.com/gk8715440-gif/Cool-boy-xmd/main/file_0000000012548243bf5dee8a3c0b406a.png';

const START_TIME = Date.now();
const logger = pino({ level: 'silent' });

let sock;
let reconnecting = false;
let stopping = false;

const groupSettings = new Map();

// WEB SERVER
app.get('/', (req, res) => {
  res.send(`${BOT_NAME} WhatsApp Bot is running!`);
});

app.get('/health', (req, res) => {
  res.json({ status: 'running', bot: BOT_NAME });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web server running on port ${PORT}`);
});

// FULL MENU
const menu = `
╭━━━〔 👑 COOL BOY XMD 〕━━━╮
┃ 🤖 WHATSAPP BOT MENU
╰━━━━━━━━━━━━━━━━━━━━━━╯

〔 GENERAL 〕
.alive
.delete
.mee
.menu
.pair
.ping
.help
.owner
.github
.uptime

〔 MUSIC 〕
.csong
.lyrics
.play
.song

〔 DOWNLOADER 〕
.fb
.insta
.pinterest
.terabox
.video
.xnxx

〔 STICKER 〕
.addspk
.brat
.circle
.delspk
.miku
.spk
.sticker
.take
.tgspk
.tgsticker
.toimg
.tomp4

〔 TEXT 〕
.fancy
.styletext

〔 FUN 〕
.kiss
.nsfw
.ship
.waifu
.waifu2

〔 GROUP 〕
.add
.admins
.antibadword
.antibot
.antidemote
.antigmention
.antigstatus
.antilink
.antimedia
.antimention
.antipromote
.antisticker
.demote
.fullgpp
.goodbye
.greacT
.groupinfo
.gstatus
.inactive
.kick
.kickall
.leave
.msgdlt
.mute
.promote
.resetwarn
.revoke
.setdesc
.setname
.tag
.tagall
.testgoodbye
.testwelcome
.unmute
.warn
.warns
.welcome
.open
.close

〔 OWNER 〕
.antidelete
.ban
.block
.broadcast
.chr
.cpost
.fullpp
.join
.listban
.mention
.mode
.restart
.sudo
.totalbot
.unban
.unblock

〔 SETTINGS 〕
.alwaysonline
.autoreact
.autoread
.autotyping
.bot_image
.botname
.prefix
.setowner
.settings

〔 UTILITY 〕
.autostatus
.gjid
.info
.jid
.lid
.url
.vv
.vv2
.weather

╭━━━━━━━━━━━━━━━━━━━━━━╮
Prefix: ${PREFIX}
Bot: ${BOT_NAME}
╰━━━━━━━━━━━━━━━━━━━━━━╯
`;

// HELPERS
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

function getUptime() {
  const seconds = Math.floor((Date.now() - START_TIME) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return `${hours}h ${minutes}m ${remaining}s`;
}

function getSettings(groupId) {
  if (!groupSettings.has(groupId)) {
    groupSettings.set(groupId, {
      antilink: false,
      welcome: false,
      goodbye: false
    });
  }
  return groupSettings.get(groupId);
}

function getNumber(jid) {
  return (jid || '').split('@')[0].replace(/\D/g, '');
}

function isLink(text) {
  return /https?:\/\/|www\.|chat\.whatsapp\.com\/|t\.me\//i.test(text);
}

async function getGroupInfo(groupId) {
  return await sock.groupMetadata(groupId);
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

  const botParticipant = metadata.participants.find(
    p => jidNormalizedUser(p.id) === botJid
  );

  return (
    botParticipant?.admin === 'admin' ||
    botParticipant?.admin === 'superadmin'
  );
}

// COMMAND HANDLER
async function processCommand(sender, messageText, message) {
  const text = messageText.trim();
  if (!text.startsWith(PREFIX)) return;

  const parts = text.slice(PREFIX.length).trim().split(/\s+/);
  const command = (parts.shift() || '').toLowerCase();
  const args = parts;

  if (!command) return;

  const isGroup = sender.endsWith('@g.us');
  const senderJid = message.key.participant || sender;
  const senderNumber = getNumber(senderJid);

  const isOwner =
    OWNER_NUMBER !== '' && senderNumber === OWNER_NUMBER;

  const reply = async content => {
    await sock.sendMessage(
      sender,
      { text: content },
      { quoted: message }
    );
  };

  const requireGroup = async () => {
    if (!isGroup) {
      await reply('❌ এই কমান্ড শুধু গ্রুপে ব্যবহার করা যাবে।');
      return false;
    }
    return true;
  };

  const requireAdmin = async () => {
    if (!(await requireGroup())) return false;

    if (!isOwner && !(await isGroupAdmin(sender, senderJid))) {
      await reply('❌ এই কমান্ডের জন্য গ্রুপ অ্যাডমিন হতে হবে।');
      return false;
    }
    return true;
  };

  // MENU IMAGE + MENU TEXT
  if (['menu', 'help'].includes(command)) {
    try {
      await sock.sendMessage(
        sender,
        {
          image: { url: MENU_IMAGE },
          caption: `👑 ${BOT_NAME}\n🤖 WhatsApp Bot Menu\nPrefix: ${PREFIX}`
        },
        { quoted: message }
      );
    } catch (error) {
      console.error('Menu image error:', error.message);
      await reply(`ছবিটি পাঠানো যায়নি। ছবির লিংক পরীক্ষা করো:\n${MENU_IMAGE}`);
    }

    await reply(menu);
    return;
  }

  // GENERAL COMMANDS
  if (command === 'ping') {
    await reply('🏓 Pong! Bot is running.');
    return;
  }

  if (command === 'alive') {
    await reply(`✅ ${BOT_NAME} is alive!\n⏱️ Uptime: ${getUptime()}`);
    return;
  }

  if (command === 'uptime') {
    await reply(`⏱️ Uptime: ${getUptime()}`);
    return;
  }

  if (command === 'owner' || command === 'setowner') {
    if (command === 'setowner' && !isOwner) {
      await reply('❌ শুধু বট Owner এই কমান্ড ব্যবহার করতে পারবেন।');
      return;
    }

    await reply(
      OWNER_NUMBER
        ? `👑 Owner: +${OWNER_NUMBER}`
        : 'Owner number সেট করা নেই।'
    );
    return;
  }

  if (command === 'github') {
    await reply(
      'GitHub Repository:\nhttps://github.com/gk8715440-gif/Cool-boy-xmd'
    );
    return;
  }

  if (['mee', 'jid', 'gjid'].includes(command)) {
    await reply(
      `Your JID: ${senderJid}\nGroup: ${isGroup ? sender : 'Private chat'}`
    );
    return;
  }

  if (command === 'info') {
    await reply(
      `🤖 ${BOT_NAME}\nPrefix: ${PREFIX}\nUptime: ${getUptime()}`
    );
    return;
  }

  if (command === 'settings') {
    if (!isGroup) {
      await reply(
        `Bot settings\nPrefix: ${PREFIX}\nOwner: ${OWNER_NUMBER || 'Not configured'}`
      );
      return;
    }

    const s = getSettings(sender);
    await reply(
      `⚙️ Group Settings\nAnti-link: ${s.antilink ? 'ON' : 'OFF'}\nWelcome: ${s.welcome ? 'ON' : 'OFF'}\nGoodbye: ${s.goodbye ? 'ON' : 'OFF'}`
    );
    return;
  }

  if (command === 'prefix') {
    await reply(`বর্তমান Prefix: ${PREFIX}`);
    return;
  }

  if (command === 'botname') {
    await reply(`Bot name: ${BOT_NAME}`);
    return;
  }

  if (command === 'bot_image') {
    await reply(`Menu image URL:\n${MENU_IMAGE}`);
    return;
  }

  // GROUP COMMANDS
  if (command === 'groupinfo') {
    if (!(await requireGroup())) return;

    const metadata = await getGroupInfo(sender);
    await reply(
      `📋 Group: ${metadata.subject}\n` +
      `👥 Members: ${metadata.participants.length}\n` +
      `🆔 JID: ${sender}`
    );
    return;
  }

  if (command === 'admins') {
    if (!(await requireGroup())) return;

    const metadata = await getGroupInfo(sender);
    const admins = metadata.participants.filter(p => p.admin);

    await sock.sendMessage(
      sender,
      {
        text: '👑 Group Admins\n\n' +
          admins.map(p => `@${getNumber(p.id)}`).join('\n'),
        mentions: admins.map(p => p.id)
      },
      { quoted: message }
    );
    return;
  }

  if (['tagall', 'tag', 'mention'].includes(command)) {
    if (!(await requireAdmin())) return;

    const metadata = await getGroupInfo(sender);
    const mentions = metadata.participants.map(p => p.id);

    await sock.sendMessage(
      sender,
      {
        text: `📢 ${args.join(' ') || 'Attention everyone!'}\n\n` +
          mentions.map(jid => `@${getNumber(jid)}`).join('\n'),
        mentions
      },
      { quoted: message }
    );
    return;
  }

  if (['kick', 'promote', 'demote'].includes(command)) {
    if (!(await requireAdmin())) return;

    const mentioned =
      message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (!mentioned.length) {
      await reply(`ব্যবহার: .${command} @mention`);
      return;
    }

    if (!(await isBotAdmin(sender))) {
      await reply('❌ Bot-কে আগে গ্রুপ Admin বানাও।');
      return;
    }

    const action =
      command === 'kick'
        ? 'remove'
        : command === 'promote'
          ? 'promote'
          : 'demote';

    await sock.groupParticipantsUpdate(sender, mentioned, action);
    await reply(`✅ ${command} কমান্ডের অনুরোধ পাঠানো হয়েছে।`);
    return;
  }

  if (command === 'open' || command === 'close') {
    if (!(await requireAdmin())) return;

    if (!(await isBotAdmin(sender))) {
      await reply('❌ Bot-কে গ্রুপ Admin বানাতে হবে।');
      return;
    }

    await sock.groupSettingUpdate(
      sender,
      command === 'open' ? 'not_announcement' : 'announcement'
    );

    await reply(
      command === 'open'
        ? '✅ গ্রুপ সবার মেসেজের জন্য খুলে দেওয়া হয়েছে।'
        : '🔒 গ্রুপ শুধু Admin-দের মেসেজের জন্য বন্ধ করা হয়েছে।'
    );
    return;
  }

  if (command === 'setname') {
    if (!(await requireAdmin())) return;

    const name = args.join(' ');
    if (!name) {
      await reply('ব্যবহার: .setname নতুন গ্রুপের নাম');
      return;
    }

    await sock.groupUpdateSubject(sender, name);
    await reply('✅ Group name update request sent.');
    return;
  }

  if (command === 'setdesc') {
    if (!(await requireAdmin())) return;

    const description = args.join(' ');
    if (!description) {
      await reply('ব্যবহার: .setdesc নতুন বিবরণ');
      return;
    }

    await sock.groupUpdateDescription(sender, description);
    await reply('✅ Group description update request sent.');
    return;
  }

  // ANTI-LINK
  if (command === 'antilink') {
    if (!(await requireAdmin())) return;

    const s = getSettings(sender);
    const option = (args[0] || '').toLowerCase();

    if (!['on', 'off'].includes(option)) {
      await reply(
        `Anti-link: ${s.antilink ? 'ON' : 'OFF'}\n` +
        'চালু: .antilink on\nবন্ধ: .antilink off'
      );
      return;
    }

    s.antilink = option === 'on';
    await reply(`✅ Anti-link ${s.antilink ? 'ON' : 'OFF'} করা হয়েছে।`);
    return;
  }

  // DELETE A REPLIED-TO MESSAGE
  if (command === 'delete' || command === 'del') {
    if (!(await requireAdmin())) return;

    const quoted = message.message?.extendedTextMessage?.contextInfo;

    if (!quoted?.stanzaId || !quoted?.participant) {
      await reply('যে মেসেজ মুছতে চাও সেটিতে Reply করে .delete লেখো।');
      return;
    }

    if (!(await isBotAdmin(sender))) {
      await reply('❌ Bot-কে গ্রুপ Admin বানাও।');
      return;
    }

    await sock.sendMessage(sender, {
      delete: {
        remoteJid: sender,
        fromMe: false,
        id: quoted.stanzaId,
        participant: quoted.participant
      }
    });
    return;
  }

  // COMMANDS THAT STILL NEED THEIR OWN INTEGRATION
  const needsIntegration = [
    'pair',
    'csong', 'lyrics', 'play', 'song',
    'fb', 'insta', 'pinterest', 'terabox', 'video', 'xnxx',
    'addspk', 'brat', 'circle', 'delspk', 'miku', 'spk',
    'sticker', 'take', 'tgspk', 'tgsticker', 'toimg', 'tomp4',
    'fancy', 'styletext', 'kiss', 'nsfw', 'ship', 'waifu', 'waifu2',
    'add', 'antibadword', 'antibot', 'antidemote',
    'antigmention', 'antigstatus', 'antimedia', 'antimention',
    'antipromote', 'antisticker', 'fullgpp', 'goodbye',
    'gstatus', 'inactive', 'kickall', 'leave', 'msgdlt',
    'mute', 'resetwarn', 'revoke', 'testgoodbye', 'testwelcome',
    'unmute', 'warn', 'warns', 'welcome',
    'antidelete', 'ban', 'block', 'broadcast', 'chr', 'cpost',
    'fullpp', 'join', 'listban', 'mode', 'restart', 'sudo',
    'totalbot', 'unban', 'unblock', 'alwaysonline', 'autoreact',
    'autoread', 'autotyping', 'autostatus', 'lid', 'url', 'vv',
    'vv2', 'weather', 'greact'
  ];

  if (needsIntegration.includes(command)) {
    if (['play', 'song', 'csong', 'lyrics'].includes(command)) {
      await reply(
        `🎵 .${command} কমান্ডের নাম মেনুতে আছে।\n` +
        'গান চালানোর জন্য আলাদা music search/download integration লাগবে।\n' +
        'এই কোডে সেই integration এখনও যোগ করা নেই।'
      );
      return;
    }

    await reply(
      `⚠️ .${command} কমান্ডটি মেনুতে আছে, কিন্তু এর কার্যকর ফিচার এখনও যোগ করা হয়নি।`
    );
    return;
  }

  await reply(
    `❓ অজানা কমান্ড: ${PREFIX}${command}\nসব কমান্ড দেখতে .menu লেখো।`
  );
}

// START WHATSAPP BOT
async function startBot() {
  if (reconnecting || stopping) return;
  reconnecting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(
      './auth_info_baileys'
    );

    sock = makeWASocket({
  auth: state,
  logger,
  printQRInTerminal: false,
  version: [2, 3000, 1033893291],
  browser: ['Ubuntu', 'Chrome', '145.0.0'],
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
console.log('Disconnect error details:', lastDisconnect?.error);
        reconnecting = false;

        if (!stopping && code !== DisconnectReason.loggedOut) {
          setTimeout(startBot, 5000);
        } else if (code === DisconnectReason.loggedOut) {
          console.log('WhatsApp logged out. Pair again.');
        }
      }
    });

    if (!state.creds.registered) {
      if (!PHONE_NUMBER) {
        console.log('Set PHONE_NUMBER in your hosting environment.');
      } else {
        try {
          await new Promise(resolve => setTimeout(resolve, 3000));
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
          if (!message.message || message.key.fromMe) continue;

          const sender = message.key.remoteJid;
          if (!sender || sender === 'status@broadcast') continue;

          const text = getText(message.message);

          // ANTI-LINK MODERATION
          if (
            sender.endsWith('@g.us') &&
            text &&
            isLink(text) &&
            !text.trim().startsWith(PREFIX)
          ) {
            const settings = getSettings(sender);
            const participant = message.key.participant;

            if (
              settings.antilink &&
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
          console.error('Message handler error:', error.message);
        }
      }
    });

  } catch (error) {
    console.error('Bot startup error:', error);
    reconnecting = false;

    if (!stopping) {
      setTimeout(startBot, 10000);
    }
    return;
  }

  reconnecting = false;
}

// SHUTDOWN
process.on('SIGTERM', async () => {
  stopping = true;
  console.log('Shutting down bot...');

  try {
    if (sock) sock.end(undefined);
  } catch (error) {
    console.error(error.message);
  }

  process.exit(0);
});

startBot();
