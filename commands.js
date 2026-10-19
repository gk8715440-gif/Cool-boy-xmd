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
    const { jidNormalizedUser } =
      await import('@whiskeysockets/baileys');

    const metadata = await getGroupInfo(sock, groupId);
    const normalized = jidNormalizedUser(participantJid);

    const participant = metadata.participants.find(
      p => jidNormalizedUser(p.id) === normalized
    );

    return (
      participant?.admin === 'admin' ||
      participant?.admin === 'superadmin'
    );
  }

  async function isBotAdmin(sock, groupId) {
    const { jidNormalizedUser } =
      await import('@whiskeysockets/baileys');

    const metadata = await getGroupInfo(sock, groupId);
    const botJid = jidNormalizedUser(sock.user.id);

    const participant = metadata.participants.find(
      p => jidNormalizedUser(p.id) === botJid
    );

    return (
      participant?.admin === 'admin' ||
      participant?.admin === 'superadmin'
    );
  }

  return async function processCommand(sender, messageText, message) {

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

    const senderNumber =
      getNumber(senderJid);

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
        await reply(
          '❌ এই কমান্ড শুধু গ্রুপে ব্যবহার করা যাবে।'
        );

        return false;
      }

      return true;
    };

    const requireAdmin = async () => {
      if (!(await requireGroup())) return false;

      if (
        !isOwner &&
        !(await isGroupAdmin(
          sock,
          sender,
          senderJid
        ))
      ) {
        await reply(
          '❌ এই কমান্ডের জন্য গ্রুপ অ্যাডমিন হতে হবে।'
        );

        return false;
      }

      return true;
    };

    // =========================
    // MENU
    // =========================

    if (['menu', 'help'].includes(command)) {

      try {
        await sock.sendMessage(
          sender,
          {
            image: {
              url: MENU_IMAGE
            },

            caption:
              `👑 ${BOT_NAME}\n` +
              `🤖 WhatsApp Bot Menu\n` +
              `Prefix: ${PREFIX}`
          },
          {
            quoted: message
          }
        );

      } catch (error) {
        console.error(
          'Menu image error:',
          error.message
        );
      }

      await reply(menu);

      return;
    }

    // =========================
    // PING
    // =========================

    if (command === 'ping') {

      await reply(
        '🏓 Pong! Bot is running.'
      );

      return;
    }

    // =========================
    // ALIVE
    // =========================

    if (command === 'alive') {

      await reply(
        `✅ ${BOT_NAME} is alive!\n` +
        `⏱️ Uptime: ${getUptime()}`
      );

      return;
    }

    // =========================
    // UPTIME
    // =========================

    if (command === 'uptime') {

      await reply(
        `⏱️ Uptime: ${getUptime()}`
      );

      return;
    }

    // =========================
    // OWNER
    // =========================

    if (['owner', 'setowner'].includes(command)) {

      if (command === 'setowner' && !isOwner) {

        await reply(
          '❌ শুধু বট Owner এই কমান্ড ব্যবহার করতে পারবেন।'
        );

        return;
      }

      await reply(
        OWNER_NUMBER
          ? `👑 Owner: +${OWNER_NUMBER}`
          : 'Owner number সেট করা নেই।'
      );

      return;
    }

    // =========================
    // GITHUB
    // =========================

    if (command === 'github') {

      await reply(
        'GitHub Repository:\n' +
        'https://github.com/gk8715440-gif/Cool-boy-xmd'
      );

      return;
    }

    // =========================
    // JID
    // =========================

    if (
      ['mee', 'jid', 'gjid'].includes(command)
    ) {

      await reply(
        `Your JID: ${senderJid}\n` +
        `Group: ${
          isGroup
            ? sender
            : 'Private chat'
        }`
      );

      return;
    }

    // =========================
    // INFO
    // =========================

    if (command === 'info') {

      await reply(
        `🤖 ${BOT_NAME}\n` +
        `Prefix: ${PREFIX}\n` +
        `Uptime: ${getUptime()}`
      );

      return;
    }

    // =========================
    // PREFIX
    // =========================

    if (command === 'prefix') {

      await reply(
        `বর্তমান Prefix: ${PREFIX}`
      );

      return;
    }

    // =========================
    // BOT NAME
    // =========================

    if (command === 'botname') {

      await reply(
        `Bot name: ${BOT_NAME}`
      );

      return;
    }

    // =========================
    // BOT IMAGE
    // =========================

    if (command === 'bot_image') {

      await reply(
        `Menu image URL:\n${MENU_IMAGE}`
      );

      return;
    }

    // =========================
    // SETTINGS
    // =========================

    if (command === 'settings') {

      if (!isGroup) {

        await reply(
          `Bot settings\n` +
          `Prefix: ${PREFIX}\n` +
          `Owner: ${
            OWNER_NUMBER || 'Not configured'
          }`
        );

        return;
      }

      const s = getSettings(sender);

      await reply(
        `⚙️ Group Settings\n` +
        `Anti-link: ${
          s.antilink ? 'ON' : 'OFF'
        }\n` +
        `Welcome: ${
          s.welcome ? 'ON' : 'OFF'
        }\n` +
        `Goodbye: ${
          s.goodbye ? 'ON' : 'OFF'
        }`
      );

      return;
    }

    // =========================
    // GROUP INFO
    // =========================

    if (command === 'groupinfo') {

      if (!(await requireGroup())) return;

      const metadata =
        await getGroupInfo(
          sock,
          sender
        );

      await reply(
        `📋 Group: ${metadata.subject}\n` +
        `👥 Members: ${
          metadata.participants.length
        }\n` +
        `🆔 JID: ${sender}`
      );

      return;
    }

    // =========================
    // ADMINS
    // =========================

    if (command === 'admins') {

      if (!(await requireGroup())) return;

      const metadata =
        await getGroupInfo(
          sock,
          sender
        );

      const admins =
        metadata.participants.filter(
          p => p.admin
        );

      await sock.sendMessage(
        sender,
        {
          text:
            '👑 Group Admins\n\n' +
            admins
              .map(
                p => `@${getNumber(p.id)}`
              )
              .join('\n'),

          mentions:
            admins.map(p => p.id)
        },
        {
          quoted: message
        }
      );

      return;
    }

    // =========================
    // TAG ALL
    // =========================

    if (
      ['tagall', 'tag', 'mention']
        .includes(command)
    ) {

      if (!(await requireAdmin())) return;

      const metadata =
        await getGroupInfo(
          sock,
          sender
        );

      const mentions =
        metadata.participants.map(
          p => p.id
        );

      await sock.sendMessage(
        sender,
        {
          text:
            `📢 ${
              args.join(' ') ||
              'Attention everyone!'
            }\n\n` +

            mentions
              .map(
                jid =>
                  `@${getNumber(jid)}`
              )
              .join('\n'),

          mentions
        },
        {
          quoted: message
        }
      );

      return;
    }

    // =========================
    // KICK / PROMOTE / DEMOTE
    // =========================

    if (
      ['kick', 'promote', 'demote']
        .includes(command)
    ) {

      if (!(await requireAdmin())) return;

      const mentioned =
        message.message
          ?.extendedTextMessage
          ?.contextInfo
          ?.mentionedJid || [];

      if (!mentioned.length) {

        await reply(
          `ব্যবহার: .${command} @mention`
        );

        return;
      }

      if (
        !(await isBotAdmin(
          sock,
          sender
        ))
      ) {

        await reply(
          '❌ Bot-কে আগে গ্রুপ Admin বানাও।'
        );

        return;
      }

      const action =
        command === 'kick'
          ? 'remove'
          : command === 'promote'
            ? 'promote'
            : 'demote';

      await sock.groupParticipantsUpdate(
        sender,
        mentioned,
        action
      );

      await reply(
        `✅ ${command} কমান্ডের অনুরোধ পাঠানো হয়েছে।`
      );

      return;
    }

    // =========================
    // OPEN / CLOSE
    // =========================

    if (
      ['open', 'close'].includes(command)
    ) {

      if (!(await requireAdmin())) return;

      if (
        !(await isBotAdmin(
          sock,
          sender
        ))
      ) {

        await reply(
          '❌ Bot-কে গ্রুপ Admin বানাতে হবে।'
        );

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
          ? '✅ গ্রুপ সবার মেসেজের জন্য খুলে দেওয়া হয়েছে।'
          : '🔒 গ্রুপ শুধু Admin-দের মেসেজের জন্য বন্ধ করা হয়েছে।'
      );

      return;
    }

    // =========================
    // SET NAME / DESCRIPTION
    // =========================

    if (
      ['setname', 'setdesc']
        .includes(command)
    ) {

      if (!(await requireAdmin())) return;

      const value =
        args.join(' ');

      if (!value) {

        await reply(
          command === 'setname'
            ? 'ব্যবহার: .setname নতুন গ্রুপের নাম'
            : 'ব্যবহার: .setdesc নতুন বিবরণ'
        );

        return;
      }

      if (command === 'setname') {

        await sock.groupUpdateSubject(
          sender,
          value
        );

      } else {

        await sock.groupUpdateDescription(
          sender,
          value
        );
      }

      await reply(
        '✅ পরিবর্তনের অনুরোধ পাঠানো হয়েছে।'
      );

      return;
    }

    // =========================
    // ANTILINK
    // =========================

    if (command === 'antilink') {

      if (!(await requireAdmin())) return;

      const s =
        getSettings(sender);

      const option =
        (args[0] || '')
          .toLowerCase();

      if (
        !['on', 'off']
          .includes(option)
      ) {

        await reply(
          `Anti-link: ${
            s.antilink
              ? 'ON'
              : 'OFF'
          }\n` +
          `চালু: .antilink on\n` +
          `বন্ধ: .antilink off`
        );

        return;
      }

      s.antilink =
        option === 'on';

      await reply(
        `✅ Anti-link ${
          s.antilink
            ? 'ON'
            : 'OFF'
        } করা হয়েছে।`
      );

      return;
    }

    // =========================
    // DELETE
    // =========================

    if (
      ['delete', 'del']
        .includes(command)
    ) {

      if (!(await requireAdmin())) return;

      const quoted =
        message.message
          ?.extendedTextMessage
          ?.contextInfo;

      if (
        !quoted?.stanzaId ||
        !quoted?.participant
      ) {

        await reply(
          'যে মেসেজ মুছতে চাও সেটিতে Reply করে .delete লেখো।'
        );

        return;
      }

      if (
        !(await isBotAdmin(
          sock,
          sender
        ))
      ) {

        await reply(
          '❌ Bot-কে গ্রুপ Admin বানাও।'
        );

        return;
      }

      await sock.sendMessage(
        sender,
        {
          delete: {
            remoteJid: sender,
            fromMe: false,
            id: quoted.stanzaId,
            participant:
              quoted.participant
          }
        }
      );

      return;
    }

   
    // =========================
    // FREE TO USE MUSIC API
    // .song and .play
    // =========================

    if (['song', 'play'].includes(command)) {
      const songName = args.join(' ').trim();

      if (!songName) {
        await reply(
          `🎵 ব্যবহার:\n` +
          `${PREFIX}song গানের নাম\n` +
          `${PREFIX}play গানের নাম\n\n` +
          `উদাহরণ: ${PREFIX}song lofi`
        );
        return;
      }

      try {
        await reply('🔎 গান খোঁজা হচ্ছে: ' + songName);

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
          throw new Error('Music API status: ' + response.status);
        }

        const result = await response.json();
        const tracks = Array.isArray(result.data)
          ? result.data
          : [];

        if (!tracks.length) {
          await reply(
            '❌ কোনো গান পাওয়া যায়নি। অন্য নাম দিয়ে চেষ্টা করো।'
          );
          return;
        }

        // .song: show search results and MP3 links
        if (command === 'song') {
          const lines = tracks.map((track, index) => {
            const artistList = Array.isArray(track.artists)
              ? track.artists.map(a =>
                  typeof a === 'string'
                    ? a
                    : a?.name || a?.title || ''
                ).filter(Boolean).join(', ')
              : '';

            const duration = Number(track.duration) || 0;
            const time = duration
              ? `${Math.floor(duration / 60)}:${String(
                  duration % 60
                ).padStart(2, '0')}`
              : 'Unknown';

            return (
              `${index + 1}. ${track.title || 'Unknown Title'}\n` +
              `👤 Artist: ${artistList || 'Unknown'}\n` +
              `⏱️ Duration: ${time}\n` +
              `🎧 MP3: ${track.files?.mp3 || 'লিংক পাওয়া যায়নি'}`
            );
          });

          await reply(
            `🎵 ${BOT_NAME} SONG SEARCH\n\n` +
            lines.join('\n\n')
          );
          return;
        }

        // .play: select a free track with an MP3 URL
        const track = tracks.find(
          item =>
            item.is_premium !== true &&
            typeof item.files?.mp3 === 'string' &&
            item.files.mp3.startsWith('https://')
        );

        if (!track) {
          await reply(
            '❌ সরাসরি ফ্রি MP3 পাওয়া যায়নি।\n' +
            `গানের লিংক দেখতে ${PREFIX}song ${songName} ব্যবহার করো।`
          );
          return;
        }

        await reply(
          `⬇️ ডাউনলোড হচ্ছে: ${track.title || songName}`
        );

        const audioResponse = await fetch(track.files.mp3, {
          signal: AbortSignal.timeout(60000)
        });

        if (!audioResponse.ok) {
          throw new Error(
            'Audio download status: ' + audioResponse.status
          );
        }

        const contentType = (
          audioResponse.headers.get('content-type') || ''
        ).toLowerCase();

        if (
          contentType.includes('text/html') ||
          contentType.includes('application/json')
        ) {
          throw new Error('The MP3 URL did not return an audio file');
        }

        const maxSize = 15 * 1024 * 1024;
        const declaredSize = Number(
          audioResponse.headers.get('content-length') || 0
        );

        if (declaredSize > maxSize) {
          await reply('❌ গানটি ১৫ MB-এর বেশি, তাই পাঠানো যাচ্ছে না।');
          return;
        }

        const audioBuffer = Buffer.from(
          await audioResponse.arrayBuffer()
        );

        if (
          audioBuffer.length === 0 ||
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
          '❌ গান খুঁজতে বা পাঠাতে সমস্যা হয়েছে।\n' +
          'কিছুক্ষণ পরে আবার চেষ্টা করো।'
        );
      }

      return;
    }

    // =========================
    // COMMANDS NOT YET INTEGRATED
    // =========================

    const needsIntegration = [
      'pair',
      'csong',
      'lyrics',
      'fb',
      'insta',
      'pinterest',
      'terabox',
      'video',
      'xnxx',
      'addspk',
      'brat',
      'circle',
      'delspk',
      'miku',
      'spk',
      'sticker',
      'take',
      'tgspk',
      'tgsticker',
      'toimg',
      'tomp4',
      'fancy',
      'styletext',
      'kiss',
      'nsfw',
      'ship',
      'waifu',
      'waifu2',
      'add',
      'antibadword',
      'antibot',
      'antidemote',
      'antigmention',
      'antigstatus',
      'antimedia',
      'antimention',
      'antipromote',
      'antisticker',
      'fullgpp',
      'goodbye',
      'gstatus',
      'inactive',
      'kickall',
      'leave',
      'msgdlt',
      'mute',
      'resetwarn',
      'revoke',
      'testgoodbye',
      'testwelcome',
      'unmute',
      'warn',
      'warns',
      'welcome',
      'antidelete',
      'ban',
      'block',
      'broadcast',
      'chr',
      'cpost',
      'fullpp',
      'join',
      'listban',
      'mode',
      'restart',
      'sudo',
      'totalbot',
      'unban',
      'unblock',
      'alwaysonline',
      'autoreact',
      'autoread',
      'autotyping',
      'autostatus',
      'lid',
      'url',
      'vv',
      'vv2',
      'weather',
      'greact'
    ];

    if (
      needsIntegration.includes(command)
    ) {

      await reply(
        `⚠️ .${command} কমান্ডের নাম মেনুতে আছে, ` +
        `কিন্তু এর কার্যকর ফিচার এখনও যোগ করা হয়নি।`
      );

      return;
    }

    // =========================
    // UNKNOWN COMMAND
    // =========================

    await reply(
      `❓ অজানা কমান্ড: ${PREFIX}${command}\n` +
      `সব কমান্ড দেখতে .menu লেখো।`
    );
  };
}