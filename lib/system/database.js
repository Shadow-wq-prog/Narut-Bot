import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const databasePath = path.join(process.cwd(), 'database', 'data');
const usersFile = path.join(databasePath, 'users.json');
const threadsFile = path.join(databasePath, 'threads.json');
const settingsFile = path.join(databasePath, 'chats.json');

// Inicializar la estructura global si no existe
global.db = global.db || { data: { users: {}, chats: {}, settings: {}, tokens: {}, tokensmod: {} } };

global.loadDatabase = () => {
  if (!fs.existsSync(databasePath)) {
    fs.mkdirSync(databasePath, { recursive: true });
  }

  const loadFile = (filePath, key) => {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8').trim();
        global.db.data[key] = content ? JSON.parse(content) : {};
      } else {
        fs.writeFileSync(filePath, '{}', 'utf-8');
        global.db.data[key] = {};
      }
    } catch (e) {
      console.log(chalk.bgRed.white(`[ DB ERROR ]`), chalk.red(`Error leyendo ${path.basename(filePath)}. Reseteando...`));
      fs.writeFileSync(filePath, '{}', 'utf-8');
      global.db.data[key] = {};
    }
  };

  loadFile(usersFile, 'users');
  loadFile(threadsFile, 'chats'); // Enlaza con threads
  loadFile(settingsFile, 'settings');
};

// Guardar de forma segura en disco
global.saveDatabase = () => {
  try {
    fs.writeFileSync(usersFile, JSON.stringify(global.db.data.users, null, 2), 'utf-8');
    fs.writeFileSync(threadsFile, JSON.stringify(global.db.data.chats, null, 2), 'utf-8');
    fs.writeFileSync(settingsFile, JSON.stringify(global.db.data.settings, null, 2), 'utf-8');
  } catch (e) {
    console.log(chalk.red(`[ DB ERROR ] No se pudo guardar la base de datos: ${e.message}`));
  }
};

// Auto-guardado cada 30 segundos
setInterval(() => {
  global.saveDatabase();
}, 30000);

export default global.db;
