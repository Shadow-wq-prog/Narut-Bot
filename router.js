import {
  Browsers,
  makeWASocket,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  jidDecode,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import pino from "pino";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import express from 'express';
import { fileURLToPath } from 'url';
import NodeCache from 'node-cache';
import { startModBot } from './lib/mods.js';
import { startPremBot } from './lib/prems.js';
import { startSubBot } from './lib/subs.js';

if (!global.conns) global.conns = [];
const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0 });
const userDevicesCache = new NodeCache({ stdTTL: 0, checkperiod: 0 });
const groupCache = new NodeCache({ stdTTL: 3600, checkperiod: 300 });
let reintentos = {};

const cleanJid = (jid = '') => jid.replace(/:\d+/, '').split('@')[0];

export default async (client, m) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const logger = express();
  
  // --- CORRECCIÓN DE PUERTOS (Evita que Termux colapse por puertos duplicados) ---
  const PORT = process.env.PORT || 30056; 
  const basePath = path.join(__dirname, './Sessions');

  // --- AUTO-REPARADOR INTEGRADO (Repara bases de datos antes de emparejar sub-bots) ---
  const fixJsonSafely = (filePath) => {
    try {
      if (!fs.existsSync(filePath)) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, '{}', 'utf-8');
        return;
      }
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      if (!content || content === "") {
        fs.writeFileSync(filePath, '{}', 'utf-8');
      } else {
        JSON.parse(content);
      }
    } catch (e) {
      console.log(chalk.bgYellow.black(`[ AUTO-FIX ]`), chalk.yellow(`Reparando JSON corrupto de forma automática...`));
      fs.writeFileSync(filePath, '{}', 'utf-8');
    }
  };

  const getBotsFromFolder = (folderName) => {
    const folderPath = path.join(basePath, folderName);
    if (!fs.existsSync(folderPath)) return [];
    return fs
      .readdirSync(folderPath)
      .filter((dir) => {
        const credsPath = path.join(folderPath, dir, 'creds.json');
        return fs.existsSync(credsPath);
      })
      .map((id) => id.replace(/\D/g, ''));
  };

  logger.get('/bots/summary', (req, res) => {
    try {
      const subs = getBotsFromFolder('Subs');
      const mods = getBotsFromFolder('Mods');
      const prems = getBotsFromFolder('Prems');

      const totalBots = 1 + subs.length + mods.length + prems.length;

      const uptime = process.uptime();
      const seconds = Math.floor(uptime % 60);
      const minutes = Math.floor((uptime / 60) % 60);
      const hours = Math.floor((uptime / 3600) % 24);
      const days = Math.floor(uptime / 86400);

      const formattedUptime = `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
      const currentTime = new Date().toLocaleString();

      return res.json({
        activeBots: totalBots,
        uptime: formattedUptime,
        time: currentTime,
        message: 'Resumen de bots obtenido exitosamente.',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Error al obtener el resumen de bots.' });
    }
  });

  const DIGITS = (s = "") => String(s).replace(/\D/g, "");

  function normalizePhoneForPairing(input) {
    let s = DIGITS(input);
    if (!s) return "";
    if (s.startsWith("0")) s = s.replace(/^0+/, "");
    if (s.length === 10 && s.startsWith("3")) s = "57" + s;
    if (s.startsWith("52") && !s.startsWith("521") && s.length >= 12) s = "521" + s.slice(2);
    if (s.startsWith("54") && !s.startsWith("549") && s.length >= 11) s = "549" + s.slice(2);
    return s;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  logger.use(express.json());
  logger.get('/', (req, res) => res.redirect('/dash'));
  logger.get('/favicon.ico', (req, res) => res.redirect('https://api.stellarwa.xyz/favicon.ico'));
  
  logger.get('/dash', (req, res) => {
    res.sendFile(path.join(__dirname, 'lib', 'public', 'index.html'));
  });
  logger.get('/script', (req, res) => {
    res.sendFile(path.join(__dirname, 'lib', 'public', 'status.js'));
  });
  logger.get('/styles', (req, res) => {
    res.sendFile(path.join(__dirname, 'lib', 'public', 'styles.css'));
  });

  const sockets = new Map();
  const sessions = new Map();

  async function startSocketIfNeeded(phone, botType) {
    if (sockets.has(phone)) return sockets.get(phone);

    const pho = normalizePhoneForPairing(phone);
    const dir = path.join(__dirname, './Sessions/', 
      botType === 'moderador' ? 'Mods' : 
      botType === 'premium' ? 'Prems' : 
      'Subs', pho
    );

    fs.mkdirSync(dir, { recursive: true });
    
    // Verificación preventiva antes de que Baileys monte las credenciales
    fixJsonSafely(path.join(dir, 'creds.json'));

    const { state, saveCreds } = await useMultiFileAuthState(dir);
    const { version } = await fetchLatestBaileysVersion();

    const s = makeWASocket({
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: Browsers.macOS('Chrome'),
      auth: state,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      getMessage: async () => '',
      msgRetryCounterCache,
      userDevicesCache,
      cachedGroupMetadata: async (jid) => groupCache.get(jid),
      version,
      keepAliveIntervalMs: 60000,
      maxIdleTimeMs: 120000,
    });

    s.isInit = false;
    s.ev.on('creds.update', saveCreds);
    s.decodeJid = (jid) => {
      if (!jid) return jid;
      if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {};
        return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
      } else return jid;
    };

    let typeFn = botType.toLowerCase() === 'moderador' ? startModBot : botType.toLowerCase() === 'premium' ? startPremBot : startSubBot;

    s.ev.on('connection.update', async ({ connection, lastDisconnect, isNewLogin }) => {
      if (isNewLogin) s.isInit = false;

      if (connection === 'open') {
        s.isInit = true;
        s.uptime = Date.now();
        s.userId = cleanJid(s.user?.id?.split('@')[0]);

        if (!global.conns.find((c) => c.userId === s.userId)) {
          global.conns.push(s);
        }
        delete reintentos[s.userId || phone];
      }

      if (connection === 'close') {
        const botId = s.userId || phone;
        const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.reason || 0;
        const intentos = reintentos[botId] || 0;
        reintentos[botId] = intentos + 1;

        if ([401, 403].includes(reason)) {
          if (intentos < 5) {
            console.log(chalk.gray(`[ ✿  ] ${botId} Conexión cerrada (${reason}) intento ${intentos}/5 → Reintentando...`));
            setTimeout(() => { typeFn(null, null, 'Auto reinicio', false, pho, null); }, 3000);
          } else {
            console.log(chalk.gray(`[ ✿  ] ${botId} Falló tras 5 intentos. Eliminando sesión.`));
            try {
              fs.rmSync(path.join(basePath, botType === 'Moderador' ? 'Mods' : botType === 'Premium' ? 'Prems' : 'Subs', pho), { recursive: true, force: true });
            } catch (e) {
              console.error(`[ ✿  ] No se pudo eliminar la carpeta`, e);
            }
            delete reintentos[botId];
          }
          return;
        }

        if ([DisconnectReason.connectionClosed, DisconnectReason.connectionLost, DisconnectReason.timedOut, DisconnectReason.connectionReplaced].includes(reason)) {
          setTimeout(() => { typeFn(null, null, 'Auto reinicio', false, pho, null); }, 3000);
          return;
        }

        setTimeout(() => { typeFn(null, null, 'Auto reinicio', false, pho, null); }, 3000);
      }
    });
    return s;
  }

  async function getStatus(phone) {
    const normalizedPhone = normalizePhoneForPairing(phone);
    const sessionDirectories = ['Subs', 'Mods', 'Prems'];
    const exists = sessionDirectories.some(dir => {
      const dirPath = path.join(__dirname, 'Sessions', dir, normalizedPhone, 'creds.json');
      return fs.existsSync(dirPath);
    });
    return { connected: exists, number: exists ? normalizedPhone : "" };
  }

  async function requestPairingCode(rawPhone, botType) {
    const phoneDigits = normalizePhoneForPairing(rawPhone);
    if (!phoneDigits) throw new Error("Número inválido.");
    const s = await startSocketIfNeeded(phoneDigits, botType);
    if (s.user) {
      const jid = s.user.id || "";
      const num = DIGITS(jid.split("@")[0]);
      const session = sessions.get(phoneDigits) || {};
      session.connectedNumber = num;
      session.detect = true;
      sessions.set(phoneDigits, session);
      return null;
    }
    await sleep(1500);
    const code = await s.requestPairingCode(phoneDigits, 'STBOTMD1');
    return String(code).match(/.{1,4}/g)?.join("-") || code;
  }

  async function startPairing(rawPhone, botType) {
    const phone = normalizePhoneForPairing(rawPhone);
    const st = await getStatus(phone);
    const numbot = st.number + "@s.whatsapp.net";
    if (st.connected) {
      return { ok: true, connected: true, number: numbot, message: `✎ Conectado como ${numbot}` };
    }
    const code = await requestPairingCode(phone, botType);
    return { ok: true, connected: false, code, message: `${code}` };
  }

  logger.post('/start-pairing', async (req, res) => {
    const { phone, label, botType, token } = req.body;
    if (!phone) return res.status(400).json({ message: 'Número de teléfono no proporcionado' });

    const pho = normalizePhoneForPairing(phone);
    let tokenData;
    const now = Date.now();

    // Verificación segura del objeto global base de datos
    if (global.db && global.db.data) {
      if (botType === 'moderador') tokenData = global.db.data.tokensmod?.[token];
      else if (botType === 'premium') tokenData = global.db.data.tokens?.[token];
    }

    if (botType !== 'subbot' && !tokenData) {
      return res.status(400).json({ ok: false, error: `El token proporcionado no es válido.` });
    }

    if (tokenData && tokenData.expires < now) {
      return res.status(400).json({ ok: false, error: 'Este token ha expirado.' });
    }

    try {
      const pairingResult = await startPairing(phone, botType);
      if (pairingResult.connected) {
        return res.json({ message: `✎ Bot conectado.`, connected: true, number: pairingResult.number });
      }
      res.json({ ok: true, id: pho + "@s.whatsapp.net", code: pairingResult.code, status: 'pending' });
    } catch (error) {
      return res.status(500).json({ message: 'Error al conectar el bot.' });
    }
  });

  logger.post('/edit-bot', async (req, res) => {
    const { phone, longName, shortName, canal, prefix, owner, banner, icon, currency, bodyMenu, menu, link } = req.body;
    if (!phone) return res.status(400).json({ message: 'Número de teléfono no proporcionado' });

    const phoneNormalized = normalizePhoneForPairing(phone);
    const idBot = phoneNormalized + "@s.whatsapp.net";

    if (global.db && global.db.data) {
      if (!global.db.data.settings) global.db.data.settings = {};
      global.db.data.settings[idBot] = {
        namebot: longName || "Masha",
        namebot2: shortName || "Masha-Bot",
        banner: banner || "",
        icon: icon || "",
        currency: currency || "$",
        prefijo: prefix || "!",
        owner: owner || "",
        bodyMenu: bodyMenu || "",
        menu: menu || "",
        link: link || ""
      };
    }
    res.json({ message: 'Configuración actualizada.', code: "STBO-TMD1" });
  });

  logger.post('/delete-bot', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Número no proporcionado' });
    const pho = normalizePhoneForPairing(phone);
    ['Subs', 'Mods', 'Prems'].forEach(dir => {
      const botSessionPath = path.join(__dirname, 'Sessions', dir, pho);
      if (fs.existsSync(botSessionPath)) fs.rmSync(botSessionPath, { recursive: true, force: true });
    });
    res.json({ message: 'Bot eliminado exitosamente.' });
  });

  logger.post('/bots/reload', async (req, res) => {
    const { phone, botType } = req.body;
    if (!phone) return res.status(400).json({ ok: false, error: 'Phone requerido.' });
    const idDigits = normalizePhoneForPairing(phone);
    let typeFn = botType.toLowerCase() === 'moderador' ? startModBot : botType.toLowerCase() === 'premium' ? startPremBot : startSubBot;
    setTimeout(() => { typeFn(null, null, 'Auto reinicio', false, idDigits, null); }, 3000);
    return res.json({ ok: true, message: 'Bot reiniciado.' });
  });

  logger.get('/bots/status', async (req, res) => {
    const phone = String(req.query.phone || '').trim();
    const idDigits = normalizePhoneForPairing(phone); 
    const s = await getStatus(idDigits); 
    res.json({ ok: true, id: idDigits + "@s.whatsapp.net", status: s.connected ? 'online' : 'offline' });
  });

  // --- ÚNICO ESCUCHADOR ACTIVO (Soluciona el error de rutas y puertos ocupados) ---
  logger.listen(PORT, () => {
    console.log(chalk.greenBright(`[ SERVER ] Dashboard desplegado correctamente en el puerto ${PORT}`));
  });
}
