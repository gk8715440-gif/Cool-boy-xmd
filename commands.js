import {
  BOT_NAME,
  PREFIX,
  OWNER_NUMBER,
  MENU_IMAGE,
  START_TIME,
  menu
} from './settings.js';

export function createCommandHandler({ getSock, groupSettings }) {
  function getUptime() {
    const seconds = Math.floor((Date.now() - START_TIME) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m ${seconds % 60}s`;
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

  async function getGroupInfo(sock, groupId) {
    return sock.groupMetadata(groupId);
  }

  async function isGroupAdmin(sock, groupId, participantJid) {
    const { jidNormalizedUser } = await import('@whiskeysockets/baileys');
    const metadata = await getGroupInfo(sock, groupId);
    const normalized = jidNormalizedUser(participantJid);

    const participant = metadata.participants.find(
      p => jidNormalizedUser(p.id) === normalized
    );

    return participant?.admin === 'admin' ||
      participant?.admin === 'superadmin';
  }

  async function isBotAdmin(sock, groupId) {
    const { jidNormalizedUser } = await import('@whiskeysockets/baileys');
    const metadata = await getGroupInfo(sock, groupId);
    const botJid = jidNormalizedUser(sock.user.id);

    const participant = metadata.participants.find(
      p => jidNormalizedUser(p.id) === botJid
    );

    return participant?.admin === 'admin' ||
      participant?.admin === 'superadmin';
  }

  return async function processCommand(sender, messageText, message) {
    const sock = getSock();
    if (!sock || !messageText) return;

    const text = messageText.trim();
    if (!text.startsWith(PREFIX)) return;

    const parts = text.slice(PREFIX.length).trim().split(/\s+/);
    const command = (parts.shift() || '').toLowerCase();
    const args = parts;
    if (!command) return;

    const isGroup = sender.endsWith('@g.us');
    const senderJid = message.key.participant || sender;
    const senderNumber = getNumber(senderJid);
    const isOwner = OWNER_NUMBER !== '' &&
      senderNumber === OWNER_NUMBER;

    const reply = async content => {
      await sock.sendMessage(sender, { text: content }, { quoted: message });
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
      if (!isOwner && !(await isGroupAdmin(sock, sender, senderJid))) {
        await reply('❌ এই কমান্ডের জন্য গ্রুপ অ্যাডমিন হতে হবে।');
        return false;
      }
      return true;
    };

    if (['menu', 'help'].includes(command)) {
      try {
        await sock.sendMessage(sender, {
          image: { url: MENU_IMAGE },
          caption: `👑 ${BOT_NAME}\n🤖 WhatsApp Bot Menu\nPrefix: ${PREFIX}`
        }, { quoted: message });
      } catch (error) {
        console.error('Menu image error:', error.message);
      }
      await reply(menu);
      return;
    }

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

    if (['owner', 'setowner'].includes(command)) {
      if (command === 'setowner' && !isOwner) {
        await reply('❌ শুধু বট Owner এই কমান্ড ব্যবহার করতে পারবেন।');
        return;
      }
      await reply(OWNER_NUMBER
        ? `👑 Owner: +${OWNER_NUMBER}`
        : 'Owner number সেট করা নেই।');
      return;
    }

    if (command === 'github') {
      await reply('GitHub Repository:\nhttps://github.com/gk8715440-gif/Cool-boy-xmd');
      return;
    }

    if (['mee', 'jid', 'gjid'].includes(command)) {
      await reply(`Your JID: ${senderJid}\nGroup: ${isGroup ? sender : 'Private chat'}`);
      return;
    }

    if