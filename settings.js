
export const BOT_NAME = 'Cool-boy-xmd';

export const PREFIX = '.';

export const PHONE_NUMBER = (
  process.env.PHONE_NUMBER || ''
).replace(/\D/g, '');

export const OWNER_NUMBER = (
  process.env.OWNER_NUMBER || ''
).replace(/\D/g, '');

export const MENU_IMAGE =
  'https://raw.githubusercontent.com/gk8715440-gif/Cool-boy-xmd/main/file_0000000012548243bf5dee8a3c0b406a.png';

export const START_TIME = Date.now();

export const menu = `
╭━━━〔 👑 COOL BOY XMD 〕━━━╮
┃ 🤖 WHATSAPP BOT MENU
╰━━━━━━━━━━━━━━━━━━━━━━╯

〔 GENERAL 〕
.menu
.help
.ping
.alive
.uptime
.owner
.github
.jid
.mee
.gjid
.info

〔 MUSIC 〕
.song
.play

〔 GROUP 〕
.groupinfo
.admins
.tagall
.tag
.kick
.promote
.demote
.open
.close
.setname
.setdesc
.antilink on/off
.welcome on/off
.goodbye on/off
.delete
.settings

〔 SETTINGS 〕
.prefix
.botname
.bot_image
.setowner

╭━━━━━━━━━━━━━━━━━━━━━━╮
Prefix: ${PREFIX}
Bot: ${BOT_NAME}
╰━━━━━━━━━━━━━━━━━━━━━━╯
`;
