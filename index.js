import * as baileys from '@whiskeysockets/baileys';
import pino from 'pino';
import express from 'express';

const makeWASocket =
  baileys.default?.default ||
  baileys.default ||
  baileys.makeWASocket;

const {
  useMultiFileAuthState,
  DisconnectReason
} = baileys;

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Cool-boy-xmd bot is running!');
});

app.listen(PORT, () => {
  console.log('Server is running on port ' + PORT);
});

const phoneNumber = (process.env.PHONE_NUMBER || '')
  .replace(/\D/g, '');

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    markOnlineOnConnect: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log('WhatsApp connected successfully!');
    }

    if (connection === 'close') {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      console.log('WhatsApp disconnected. Status:', statusCode);

      if (statusCode === DisconnectReason.loggedOut) {
        console.log('WhatsApp logged out. Pair again.');
      }
    }
  });

  if (!state.creds.registered) {
    if (!phoneNumber) {
      console.log(
        'Please set PHONE_NUMBER in Render Environment.'
      );
    } else {
      setTimeout(async () => {
        try {
          if (state.creds.registered) return;

          const code = await sock.requestPairingCode(
            phoneNumber
          );

          console.log('Pairing code:', code);
        } catch (error) {
          console.error(
            'Pairing code error:',
            error.message
          );
        }
      }, 3000);
    }
  }

  sock.ev.on(
    'messages.upsert',
    async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const sender = msg.key.remoteJid;

        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          '';

        if (!sender || !text.startsWith('.')) continue;

        const command = text
          .slice(1)
          .trim()
          .toLowerCase();

        if (command === 'ping') {
          await sock.sendMessage(sender, {
            text: '🏓 Pong! Cool-boy-xmd is online.'
          });
        } else if (
          ['menu', 'help', 'gmenu', 'funmenu'].includes(command)
        ) {
          await sock.sendMessage(sender, {
            text:
              '🤖 COOL-BOY-XMD MENU\n\n' +
              '.ping - Check bot status\n' +
              '.alive - Check bot online status\n' +
              '.help - Show this menu'
          });
        } else if (command === 'alive') {
          await sock.sendMessage(sender, {
            text: '✅ Cool-boy-xmd bot is running.'
          });
        }
      }
    }
  );
}

startBot().catch((error) => {
  console.error('Bot startup error:', error);
});
