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
return ${hours}h ${minutes}m ${seconds % 60}s;
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

if (command === 'info') {  
  await reply(`🤖 ${BOT_NAME}\nPrefix: ${PREFIX}\nUptime: ${getUptime()}`);  
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

if (command === 'settings') {  
  if (!isGroup) {  
    await reply(`Bot settings\nPrefix: ${PREFIX}\nOwner: ${OWNER_NUMBER || 'Not configured'}`);  
    return;  
  }  
  const s = getSettings(sender);  
  await reply(`⚙️ Group Settings\nAnti-link: ${s.antilink ? 'ON' : 'OFF'}\nWelcome: ${s.welcome ? 'ON' : 'OFF'}\nGoodbye: ${s.goodbye ? 'ON' : 'OFF'}`);  
  return;  
}  

if (command === 'groupinfo') {  
  if (!(await requireGroup())) return;  
  const metadata = await getGroupInfo(sock, sender);  
  await reply(`📋 Group: ${metadata.subject}\n👥 Members: ${metadata.participants.length}\n🆔 JID: ${sender}`);  
  return;  
}  

if (command === 'admins') {  
  if (!(await requireGroup())) return;  
  const metadata = await getGroupInfo(sock, sender);  
  const admins = metadata.participants.filter(p => p.admin);  
  await sock.sendMessage(sender, {  
    text: '👑 Group Admins\n\n' + admins.map(p => `@${getNumber(p.id)}`).join('\n'),  
    mentions: admins.map(p => p.id)  
  }, { quoted: message });  
  return;  
}  

if (['tagall', 'tag', 'mention'].includes(command)) {  
  if (!(await requireAdmin())) return;  
  const metadata = await getGroupInfo(sock, sender);  
  const mentions = metadata.participants.map(p => p.id);  
  await sock.sendMessage(sender, {  
    text: `📢 ${args.join(' ') || 'Attention everyone!'}\n\n` +  
      mentions.map(jid => `@${getNumber(jid)}`).join('\n'),  
    mentions  
  }, { quoted: message });  
  return;  
}  

if (['kick', 'promote', 'demote'].includes(command)) {  
  if (!(await requireAdmin())) return;  
  const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];  
  if (!mentioned.length) {  
    await reply(`ব্যবহার: .${command} @mention`);  
    return;  
  }  
  if (!(await isBotAdmin(sock, sender))) {  
    await reply('❌ Bot-কে আগে গ্রুপ Admin বানাও।');  
    return;  
  }  
  const action = command === 'kick' ? 'remove' :  
    command === 'promote' ? 'promote' : 'demote';  
  await sock.groupParticipantsUpdate(sender, mentioned, action);  
  await reply(`✅ ${command} কমান্ডের অনুরোধ পাঠানো হয়েছে।`);  
  return;  
}  

if (['open', 'close'].includes(command)) {  
  if (!(await requireAdmin())) return;  
  if (!(await isBotAdmin(sock, sender))) {  
    await reply('❌ Bot-কে গ্রুপ Admin বানাতে হবে।');  
    return;  
  }  
  await sock.groupSettingUpdate(  
    sender,  
    command === 'open' ? 'not_announcement' : 'announcement'  
  );  
  await reply(command === 'open'  
    ? '✅ গ্রুপ সবার মেসেজের জন্য খুলে দেওয়া হয়েছে।'  
    : '🔒 গ্রুপ শুধু Admin-দের মেসেজের জন্য বন্ধ করা হয়েছে।');  
  return;  
}  

if (['setname', 'setdesc'].includes(command)) {  
  if (!(await requireAdmin())) return;  
  const value = args.join(' ');  
  if (!value) {  
    await reply(command === 'setname'  
      ? 'ব্যবহার: .setname নতুন গ্রুপের নাম'  
      : 'ব্যবহার: .setdesc নতুন বিবরণ');  
    return;  
  }  
  if (command === 'setname') {  
    await sock.groupUpdateSubject(sender, value);  
  } else {  
    await sock.groupUpdateDescription(sender, value);  
  }  
  await reply('✅ পরিবর্তনের অনুরোধ পাঠানো হয়েছে।');  
  return;  
}  

if (command === 'antilink') {  
  if (!(await requireAdmin())) return;  
  const s = getSettings(sender);  
  const option = (args[0] || '').toLowerCase();  
  if (!['on', 'off'].includes(option)) {  
    await reply(`Anti-link: ${s.antilink ? 'ON' : 'OFF'}\nচালু: .antilink on\nবন্ধ: .antilink off`);  
    return;  
  }  
  s.antilink = option === 'on';  
  await reply(`✅ Anti-link ${s.antilink ? 'ON' : 'OFF'} করা হয়েছে।`);  
  return;  
}  

if (['delete', 'del'].includes(command)) {  
  if (!(await requireAdmin())) return;  
  const quoted = message.message?.extendedTextMessage?.contextInfo;  
  if (!quoted?.stanzaId || !quoted?.participant) {  
    await reply('যে মেসেজ মুছতে চাও সেটিতে Reply করে .delete লেখো।');  
    return;  
  }  
  if (!(await isBotAdmin(sock, sender))) {  
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

const needsIntegration = [  
  'pair', 'csong', 'lyrics', 'play', 'song',  
  'fb', 'insta', 'pinterest', 'terabox', 'video', 'xnxx',  
  'addspk', 'brat', 'circle', 'delspk', 'miku', 'spk',  
  'sticker', 'take', 'tgspk', 'tgsticker', 'toimg', 'tomp4',  
  'fancy', 'styletext', 'kiss', 'nsfw', 'ship', 'waifu', 'waifu2',  
  'add', 'antibadword', 'antibot', 'antidemote', 'antigmention',  
  'antigstatus', 'antimedia', 'antimention', 'antipromote',  
  'antisticker', 'fullgpp', 'goodbye', 'gstatus', 'inactive',  
  'kickall', 'leave', 'msgdlt', 'mute', 'resetwarn', 'revoke',  
  'testgoodbye', 'testwelcome', 'unmute', 'warn', 'warns', 'welcome',  
  'antidelete', 'ban', 'block', 'broadcast', 'chr', 'cpost',  
  'fullpp', 'join', 'listban', 'mode', 'restart', 'sudo',  
  'totalbot', 'unban', 'unblock', 'alwaysonline', 'autoreact',  
  'autoread', 'autotyping', 'autostatus', 'lid', 'url', 'vv', 'vv2',  
  'weather', 'greact'  
];  

if (needsIntegration.includes(command)) {  
  await reply(`⚠️ .${command} কমান্ডের নাম মেনুতে আছে, কিন্তু এর কার্যকর ফিচার এখনও যোগ করা হয়নি।`);  
  return;  
}  

await reply(`❓ অজানা কমান্ড: ${PREFIX}${command}\nসব কমান্ড দেখতে .menu লেখো।`);

};
}