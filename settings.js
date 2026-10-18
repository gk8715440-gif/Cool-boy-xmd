
export const BOT_NAME = 'Cool-boy-xmd';
export const PREFIX = '.';

export const PHONE_NUMBER = (process.env.PHONE_NUMBER || '').replace(/\D/g, '');
export const OWNER_NUMBER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');

export const MENU_IMAGE =
  'https://raw.githubusercontent.com/gk8715440-gif/Cool-boy-xmd/main/file_0000000012548243bf5dee8a3c0b406a.png';

export const START_TIME = Date.now();

export const menu = `
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
