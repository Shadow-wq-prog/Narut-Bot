import { jidNormalizedUser } from "@whiskeysockets/baileys";

export async function smsg(client, m, store) {
  if (!m) return m;
  let M = m.key;
  if (M) {
    m.id = M.id;
    m.isBaileys = m.id.startsWith('BAE5') && m.id.length === 16;
    m.chat = M.remoteJid;
    m.fromMe = M.fromMe;
    m.isGroup = m.chat.endsWith('@g.us');
    m.sender = jidNormalizedUser(m.fromMe ? client.user.id : m.participant || m.key.participant || m.chat || '');
  }
  
  if (m.message) {
    m.mtype = Object.keys(m.message)[0];
    m.msg = m.message[m.mtype];
    m.text = m.message.conversation || m.msg.text || m.msg.caption || m.msg.selectedDisplayText || m.msg.hydratedTemplate?.hydratedContentText || '';
    if (typeof m.text !== 'string') m.text = '';
  } else {
    m.text = '';
  }

  // --- REGISTRO AUTOMÁTICO EN LA BASE DE DATOS ---
  if (global.db && global.db.data) {
    // Registrar usuario si no existe
    if (m.sender) {
      if (!global.db.data.users) global.db.data.users = {};
      if (!global.db.data.users[m.sender]) {
        global.db.data.users[m.sender] = {
          name: m.pushName || 'Usuario Masha',
          banned: false,
          premium: false,
          limit: 20
        };
      }
    }

    // Registrar grupo/chat si no existe
    if (m.chat) {
      if (!global.db.data.chats) global.db.data.chats = {};
      if (!global.db.data.chats[m.chat]) {
        global.db.data.chats[m.chat] = {
          welcome: true,
          detect: true,
          isBanned: false
        };
      }
    }
  }
  
  // Función de respuesta directa simplificada
  m.reply = (text, chatId, options) => client.sendMessage(chatId ? chatId : m.chat, { text: text }, { quoted: m, ...options });
  
  return m;
}
