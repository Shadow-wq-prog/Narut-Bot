import { makeWASocket, Browsers, useMultiFileAuthState, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import pino from "pino";
import chalk from "chalk";

export async function startPremBot(auth, m, reason, status, userId, sessionPath) {
  console.log(chalk.magenta(`[ PREMIUM ] Iniciando conexión automática para el usuario: ${userId}`));
  
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: Browsers.macOS('Chrome'),
    auth: state
  });

  sock.ev.on('creds.update', saveCreds);
  
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log(chalk.green(`[ PREMIUM ] Bot @${userId} conectado exitosamente.`));
    }
  });

  return sock;
}
