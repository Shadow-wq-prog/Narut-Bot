import "./settings.js"
import handler from './handler.js'
import events from './cms/events.js'
import router from './router.js'
import {
  Browsers,
  makeWASocket,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  jidDecode,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import cfonts from 'cfonts';
import pino from "pino";
import qrcode from "qrcode-terminal";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import readlineSync from "readline-sync";
import boxen from 'boxen';
import { smsg } from "./lib/message.js";
import db from "./lib/system/database.js";
import { startSubBot } from './lib/subs.js';
import { startModBot } from './lib/mods.js';
import { startPremBot } from './lib/prems.js';
import { exec } from "child_process";

const log = {
  info: (msg) => console.log(chalk.bgBlue.white.bold(`INFO`), chalk.white(msg)),
  success: (msg) => console.log(chalk.bgGreen.white.bold(`SUCCESS`), chalk.greenBright(msg)),
  warn: (msg) => console.log(chalk.bgYellowBright.blueBright.bold(`WARNING`), chalk.yellow(msg)),
  warning: (msg) => console.log(chalk.bgYellowBright.red.bold(`WARNING`), chalk.yellow(msg)),
  error: (msg) => console.log(chalk.bgRed.white.bold(`ERROR`), chalk.redBright(msg)),
};

// --- AUTO-REPARACIÓN AUTOMÁTICA DE BASE DE DATOS ---
function fixDatabaseFiles() {
  const dataDir = path.join(process.cwd(), 'database', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const filesToCheck = ['threads.json', 'users.json', 'chats.json'];
  
  filesToCheck.forEach(file => {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '{}', 'utf-8');
      log.info(`Archivo base creado: database/data/${file}`);
    } else {
      try {
        const content = fs.readFileSync(filePath, 'utf-8').trim();
        if (!content || content === "") {
          fs.writeFileSync(filePath, '{}', 'utf-8');
        } else {
          JSON.parse(content); // Prueba si el JSON es válido
        }
      } catch (e) {
        log.warning(`¡Detectado archivo corrupto! Reparando automáticamente: database/data/${file}`);
        fs.writeFileSync(filePath, '{}', 'utf-8'); // Auto-reseteo seguro
      }
    }
  });
}

// Ejecutar la auto-reparación antes de que cualquier otra función lea la base de datos
fixDatabaseFiles();

const askQuestion = readlineSync
let usarCodigo = false
let numero = "";
let phoneInput = "";

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

const { say } = cfonts
say('masha', { font: 'block', align: 'center', gradient: ['blue', 'magenta'] })
say('Basado en Sophia-Wa Bot by SpaceNight Team', { font: 'console', align: 'center', gradient: ['green', 'blue'] })

console.log(chalk.bold.rgb(100, 100, 255)('\n' + ' '.repeat(25) + 'Маша' + '\n'));
console.log(chalk.bold.rgb(100, 100, 255)('\n' + ' '.repeat(15) + 'Creado por: 亗𝙽𝚎𝚝𝚑𝚎𝚛𝙻𝚘𝚛𝚍亗' + '\n'));

const BOT_TYPES = [
  { name: 'SubBot', folder: './Sessions/Subs', starter: startSubBot },
  { name: 'ModBot', folder: './Sessions/Mods', starter: startModBot },
  { name: 'PremBot', folder: './Sessions/Prems', starter: startPremBot }
]

global.conns = global.conns || []
const reconnecting = new Map()
const connectedUsers = new Set(global.conns.map(c => c.userId))
const jidRegex = /:\d+@/gi

async function loadBots() {
  for (const { name, folder, starter } of BOT_TYPES) {
    if (!fs.existsSync(folder)) continue
    const botIds = fs.readdirSync(folder)
    
    const loadPromises = botIds.map(async (userId) => {
      const sessionPath = path.join(folder, userId)
      const credsPath = path.join(sessionPath, 'creds.json')
      if (!fs.existsSync(cre
