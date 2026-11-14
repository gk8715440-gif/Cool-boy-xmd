
import {
  BOT_NAME,
  PREFIX,
  OWNER_NUMBER,
  MENU_IMAGE,
  START_TIME,
  menu
} from './settings.js';

import {
  jidNormalizedUser
} from '@whiskeysockets/baileys';

export function createCommandHandler({
  getSock,
  groupSettings
}) {
  function getUptime() {
    const seconds = Math.floor(
      (Date.now() - START_TIME) / 1000
    );

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${hours}h ${minutes}m ${seconds % 60}s`;
  }

  function getNumber(jid) {
    return (jid || '').split('@')[0].replace(/\D/g, '');
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

  async function isGroupAdmin(sock, groupId, jid) {
    const metadata = await sock.groupMetadata(groupId);
    const target = jidNormalizedUser(jid);

    const participant = metadata.participants.find(
      p => jidNormalizedUser(p.id) === target
    );

    return participant?.admin === 'admin' ||
      participant?.admin === 'superadmin';
  }

  async function isBotAdmin(sock, groupId) {
    return isGroupAdmin(sock, groupId, sock.user.id);
  }

  return async function processCommand(
    sender,
    messageText,
    message
  ) {
    const sock = getSock();

    if (!sock || !messageText) return;

    const text = messageText.trim();

    if (!text.startsWith(PREFIX)) return;

    const parts = text
      .slice(PREFIX.length)
      .trim()
      .split(/\s+/);

    const command = (parts.shift() || '').toLowerCase();
    const args = parts;

    if (!command) return;

    const isGroup = sender.endsWith('@g.us');

    const senderJid =
      message.key.participant || sender;

    const senderNumber = getNumber(senderJid);

    const isOwner =
      OWNER_NUMBER !== '' &&
      senderNumber === OWNER_NUMBER;

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

      if (
        !isOwner &&
        !(await isGroupAdmin(sock, sender, senderJid))
      ) {
        await reply('❌ এই কমান্ডের জন্য গ্রুপ অ্যাডমিন হতে হবে।');
        return false;
      }

      return true;
    };

    // MENU
    if (['menu', 'help'].includes(command)) {
      try {
        await sock.sendMessage(
          sender,
          {
            image: { url: MENU_IMAGE },
            caption:
              `👑 ${BOT_NAME}\n` +
              `🤖 WhatsApp Bot Menu\n` +
              `Prefix: ${PREFIX}`
          },
          { quoted: message }
        );
      } catch (error) {
        console.error('Menu image error:', error.message);
      }

      await reply(menu);
      return;
    }

    // GENERAL
    if (command === 'ping') {
      await reply('🏓 Pong! Bot is running.');
      return;
    }

    if (command === 'alive') {
      await reply(
        `✅ ${BOT_NAME} is alive!\n⏱️ Uptime: ${getUptime()}`
      );
      return;
    }

    if (command === 'uptime') {
      await reply(`⏱️ Uptime: ${getUptime()}`);
      return;
    }

    if (command === 'owner') {
      await reply(
        OWNER_NUMBER
          ? `👑 Owner: +${OWNER_NUMBER}`
          : 'Owner number সেট করা নেই।'
      );
      return;
    }

    if (command === 'setowner') {
      if (!isOwner) {
        await reply('❌ শুধু Owner এই কমান্ড ব্যবহার করতে পারবেন।');
        return;
      }

      await reply(
        'Owner Number Render Environment Variables থেকে পরিবর্তন করো।'
      );
      return;
    }

    if (command === 'github') {
      await reply(
        'GitHub Repository:\n' +
        'https://github.com/gk8715440-gif/Cool-boy-xmd'
      );
      return;
    }

    if (['jid', 'mee', 'gjid'].includes(command)) {
      await reply(
        `Your JID: ${senderJid}\n` +
        `Group: ${isGroup ? sender : 'Private chat'}`
      );
      return;
    }

    if (command === 'info') {
      await reply(
        `🤖 ${BOT_NAME}\n` +
        `Prefix: ${PREFIX}\n` +
        `Uptime: ${getUptime()}`
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

    // SETTINGS
    if (command === 'settings') {
      if (!isGroup) {
        await reply(
          `Bot Settings\nPrefix: ${PREFIX}\nOwner: ${OWNER_NUMBER || 'Not configured'}`
        );
        return;
      }

      const s = getSettings(sender);

      await reply(
        `⚙️ Group Settings\n` +
        `Anti-link: ${s.antilink ? 'ON' : 'OFF'}\n` +
        `Welcome: ${s.welcome ? 'ON' : 'OFF'}\n` +
        `Goodbye: ${s.goodbye ? 'ON' : 'OFF'}`
      );
      return;
    }

    // GROUP INFO
    if (command === 'groupinfo') {
      if (!(await requireGroup())) return;

      const metadata = await sock.groupMetadata(sender);

      await reply(
        `📋 Group: ${metadata.subject}\n` +
        `👥 Members: ${metadata.participants.length}\n` +
        `🆔 JID: ${sender}`
      );
      return;
    }

    // ADMINS
    if (command === 'admins') {
      if (!(await requireGroup())) return;

      const metadata = await sock.groupMetadata(sender);

      const admins = metadata.participants.filter(
        p => p.admin
      );

      await sock.sendMessage(
        sender,
        {
          text:
            '👑 Group Admins\n\n' +
            admins.map(
              p => `@${getNumber(p.id)}`
            ).join('\n'),
          mentions: admins.map(p => p.id)
        },
        { quoted: message }
      );
      return;
    }

    // TAG ALL
    if (['tagall', 'tag', 'mention'].includes(command)) {
      if (!(await requireAdmin())) return;

      const metadata = await sock.groupMetadata(sender);

      const mentions = metadata.participants.map(
        p => p.id
      );

      await sock.sendMessage(
        sender,
        {
          text:
            `📢 ${args.join(' ') || 'Attention everyone!'}\n\n` +
            mentions.map(
              jid => `@${getNumber(jid)}`
            ).join('\n'),
          mentions
        },
        { quoted: message }
      );
      return;
    }

    // KICK / PROMOTE / DEMOTE
    if (['kick', 'promote', 'demote'].includes(command)) {
      if (!(await requireAdmin())) return;

      const mentioned =
        message.message?.extendedTextMessage
          ?.contextInfo?.mentionedJid || [];

      if (!mentioned.length) {
        await reply(`ব্যবহার: .${command} @mention`);
        return;
      }

      if (!(await isBotAdmin(sock, sender))) {
        await reply('❌ Bot-কে আগে Group Admin বানাও।');
        return;
      }

      const action = command === 'kick'
        ? 'remove'
        : command;

      await sock.groupParticipantsUpdate(
        sender,
        mentioned,
        action
      );

      await reply(`✅ ${command} কমান্ড সম্পন্ন হয়েছে।`);
      return;
    }

    // OPEN / CLOSE
    if (['open', 'close'].includes(command)) {
      if (!(await requireAdmin())) return;

      if (!(await isBotAdmin(sock, sender))) {
        await reply('❌ Bot-কে Group Admin বানাও।');
        return;
      }

      await sock.groupSettingUpdate(
        sender,
        command === 'open'
          ? 'not_announcement'
          : 'announcement'
      );

      await reply(
        command === 'open'
          ? '✅ Group সবার জন্য খুলে দেওয়া হয়েছে।'
          : '🔒 Group শুধু Admin-দের জন্য বন্ধ করা হয়েছে।'
      );
      return;
    }

    // SET NAME / DESCRIPTION
    if (['setname', 'setdesc'].includes(command)) {
      if (!(await requireAdmin())) return;

      const value = args.join(' ');

      if (!value) {
        await reply(
          command === 'setname'
            ? 'ব্যবহার: .setname নতুন নাম'
            : 'ব্যবহার: .setdesc নতুন বিবরণ'
        );
        return;
      }

      if (!(await isBotAdmin(sock, sender))) {
        await reply('❌ Bot-কে Group Admin বানাও।');
        return;
      }

      if (command === 'setname') {
        await sock.groupUpdateSubject(sender, value);
      } else {
        await sock.groupUpdateDescription(sender, value);
      }

      await reply('✅ Group পরিবর্তন করা হয়েছে।');
      return;
    }

    // ANTILINK
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

      await reply(
        `✅ Anti-link ${s.antilink ? 'ON' : 'OFF'} করা হয়েছে।`
      );
      return;
    }

    // WELCOME / GOODBYE SETTINGS
    if (['welcome', 'goodbye'].includes(command)) {
      if (!(await requireAdmin())) return;

      const s = getSettings(sender);
      const option = (args[0] || '').toLowerCase();

      if (!['on', 'off'].includes(option)) {
        await reply(
          `${command}: ${s[command] ? 'ON' : 'OFF'}\n` +
          `চালু: .${command} on\nবন্ধ: .${command} off`
        );
        return;
      }

      s[command] = option === 'on';

      await reply(
        `✅ ${command} ${s[command] ? 'ON' : 'OFF'} করা হয়েছে।`
      );
      return;
    }

    // DELETE
    if (['delete', 'del'].includes(command)) {
      if (!(await requireAdmin())) return;

      const quoted =
        message.message?.extendedTextMessage?.contextInfo;

      if (!quoted?.stanzaId || !quoted?.participant) {
        await reply(
          'যে মেসেজ মুছতে চাও সেটিতে Reply করে .delete লেখো।'
        );
        return;
      }

      if (!(await isBotAdmin(sock, sender))) {
        await reply('❌ Bot-কে Group Admin বানাও।');
        return;
      }

      await sock.sendMessage(
        sender,
        {
          delete: {
            remoteJid: sender,
            fromMe: false,
            id: quoted.stanzaId,
            participant: quoted.participant
          }
        }
      );
      return;
    }

    // SONG / PLAY
    if (['song', 'play'].includes(command)) {
      const songName = args.join(' ').trim();

      if (!songName) {
        await reply(
          `🎵 ব্যবহার:\n.song গানের নাম\n.play গানের নাম`
        );
        return;
      }

      try {
        await reply(`🔎 গান খোঁজা হচ্ছে: ${songName}`);

        const apiUrl = new URL(
          'https://api.freetouse.com/v3/music/tracks/search'
        );

        apiUrl.searchParams.set('query', songName);
        apiUrl.searchParams.set('limit', '5');
        apiUrl.searchParams.set('order', 'plays');
        apiUrl.searchParams.set('sort', 'desc');

        const response = await fetch(apiUrl, {
          signal: AbortSignal.timeout(20000)
        });

        if (!response.ok) {
          throw new Error(`Music API status: ${response.status}`);
        }

        const result = await response.json();

        const tracks = Array.isArray(result.data)
          ? result.data
          : [];

        if (!tracks.length) {
          await reply('❌ কোনো গান পাওয়া যায়নি।');
          return;
        }

        if (command === 'song') {
          const lines = tracks.map((track, index) => {
            const artists = Array.isArray(track.artists)
              ? track.artists.map(a =>
                  typeof a === 'string'
                    ? a
                    : a?.name || a?.title || ''
                ).filter(Boolean).join(', ')
              : '';

            const duration = Number(track.duration) || 0;

            const time = duration
              ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`
              : 'Unknown';

            return (
              `${index + 1}. ${track.title || 'Unknown'}\n` +
              `👤 Artist: ${artists || 'Unknown'}\n` +
              `⏱️ Duration: ${time}\n` +
              `🎧 MP3: ${track.files?.mp3 || 'লিংক নেই'}`
            );
          });

          await reply(
            `🎵 ${BOT_NAME} SONG SEARCH\n\n${lines.join('\n\n')}`
          );
          return;
        }

        const track = tracks.find(
          item =>
            item.is_premium !== true &&
            typeof item.files?.mp3 === 'string' &&
            item.files.mp3.startsWith('https://')
        );

        if (!track) {
          await reply('❌ ফ্রি MP3 পাওয়া যায়নি।');
          return;
        }

        await reply(`⬇️ ডাউনলোড হচ্ছে: ${track.title}`);

        const audioResponse = await fetch(track.files.mp3, {
          signal: AbortSignal.timeout(60000)
        });

        if (!audioResponse.ok) {
          throw new Error('Audio download failed');
        }

        const maxSize = 15 * 1024 * 1024;
        const declaredSize = Number(
          audioResponse.headers.get('content-length') || 0
        );

        if (declaredSize > maxSize) {
          await reply('❌ গানটি ১৫ MB-এর বেশি।');
          return;
        }

        const contentType = (
          audioResponse.headers.get('content-type') || ''
        ).toLowerCase();

        if (
          contentType.includes('text/html') ||
          contentType.includes('application/json')
        ) {
          throw new Error('Invalid audio response');
        }

        const audioBuffer = Buffer.from(
          await audioResponse.arrayBuffer()
        );

        if (
          !audioBuffer.length ||
          audioBuffer.length > maxSize
        ) {
          await reply('❌ অডিও ফাইলটি খালি অথবা অনেক বড়।');
          return;
        }

        const safeName = String(track.title || 'music')
          .replace(/[\\/:*?"<>|]/g, '_')
          .slice(0, 80);

        await sock.sendMessage(
          sender,
          {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${safeName}.mp3`,
            ptt: false
          },
          { quoted: message }
        );
      } catch (error) {
        console.error('[MUSIC ERROR]', error);

        await reply(
          '❌ গান খুঁজতে বা পাঠাতে সমস্যা হয়েছে। পরে আবার চেষ্টা করো।'
        );
      }

      return;
    }

    // COMMANDS NOT YET IMPLEMENTED
    const notImplemented = [
      'pair', 'csong', 'lyrics', 'fb', 'insta',
      'pinterest', 'terabox', 'video',
      'addspk', 'brat', 'circle', 'delspk',
      'miku', 'spk', 'sticker', 'take',
      'tgspk', 'tgsticker', 'toimg', 'tomp4',
      'fancy', 'styletext', 'kiss', 'ship',
      'waifu', 'waifu2', 'add', 'antibadword',
      'antibot', 'antidemote', 'antigmention',
      'antigstatus', 'antimedia', 'antimention',
      'antipromote', 'antisticker', 'fullgpp',
      'gstatus', 'inactive', 'kickall', 'leave',
      'msgdlt', 'mute', 'resetwarn', 'revoke',
      'testgoodbye', 'testwelcome', 'unmute',
      'warn', 'warns', 'antidelete', 'ban',
      'block', 'broadcast', 'chr', 'cpost',
      'fullpp', 'join', 'listban', 'mode',
      'restart', 'sudo', 'totalbot', 'unban',
      'unblock', 'alwaysonline', 'autoreact',
      'autoread', 'autotyping', 'autostatus',
      'lid', 'url', 'vv', 'vv2', 'weather',
      'greact'
    ];

    if (notImplemented.includes(command)) {
      await reply(
        `⚠️ .${command} কমান্ডের ফিচার এখনও যোগ করা হয়নি।`
      );
      return;
    }

    await reply(
      `❓ অজানা কমান্ড: ${PREFIX}${command}\nসব কমান্ড দেখতে .menu লেখো।`
    );
  };
}
