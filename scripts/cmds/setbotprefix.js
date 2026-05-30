/*
Creador: 𝙎𝙝𝙖𝙙𝙤𝙬 𝙁𝙡𝙖𝙨𖤐⁩
Comando: prefix (Configurar prefijos del bot y sub-bots)
*/

module.exports = {
    config: {
        name: "prefix",
        version: "1.0.0",
        author: "𝙎𝙝𝙖𝙙𝙤𝙬 𝙁𝙡𝙖𝙨𖤐⁩",
        countDown: 3,
        role: 2, // Solo el Owner/Creador del bot puede usarlo
        description: "Cambia el prefijo o prefijos de los comandos del bot o sub-bots",
        category: "owner",
        guide: "{pn} [símbolo]"
    },

    onMessage: async function ({ message, args, sock }) {
        const from = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;

        // Identificar el ID del bot actual de forma limpia
        const ownerBotId = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        // Inicializar la base de datos global si no existe
        global.db = global.db || { data: { settings: {}, chats: {} } };
        global.db.data.settings = global.db.data.settings || {};

        let targetArg = null;
        let argumentos = [...args];

        if (argumentos && argumentos.length > 0) {
            const possible = String(argumentos[0]).replace(/\s+/g, '');
            if (/^\d{8,15}$/.test(possible) || /@s\.whatsapp\.net$/.test(possible)) {
                targetArg = possible;
                argumentos = argumentos.slice(1);
            }
        }

        let targetBotId = ownerBotId;
        if (targetArg) {
            const normalized = targetArg.includes('@') ? targetArg : `${targetArg}@s.whatsapp.net`;
            
            // Verificación de creador global
            const isGlobalOwner = [ownerBotId, ...(global.owner || []).map(n => n + '@s.whatsapp.net')].includes(sender);
            if (!isGlobalOwner) {
                return sock.sendMessage(from, { text: '✘ Solo el owner global puede cambiar el prefijo de otros sub-bots.' }, { quoted: message });
            }
            targetBotId = normalized;
        }

        global.db.data.settings[targetBotId] = global.db.data.settings[targetBotId] || {};
        const config = global.db.data.settings[targetBotId];

        const value = argumentos.join(' ').trim();
        
        // Mensaje de ayuda si no envías ningún prefijo
        const menuAyudaPrefijos = `✎ *Creador:* 𝙎𝙝𝙖𝙙𝙤𝙬 𝙁𝙡𝙖𝙨𖤐⁩\n\nEnvía el nuevo prefijo o prefijos para el bot.\n\n` +
            `> Default: \`/\` \`#\`\n` +
            `> ──────────────\n` +
            `> Math: \`+\` \`-\` \`~\` \`×\` \`÷\` \`=\` \`\π\` \`\√\` \`%\`\n` +
            `> ──────────────\n` +
            `> Money: \`€\` \`£\` \`¥\` \`$\` \`₽\` \`¢\`\n` +
            `> ──────────────\n` +
            `> Unicode: \`¤\` \`●\` \`□\` \`■\` \`☆\` \`♤\` \`♡\` \`◇\` \`♧\`\n` +
            `> ──────────────\n` +
            `> Others: \`¿\` \`?\` \`,\` \`.\` \`¡\` \`!\` \`^\` \`&\` \`<\` \`:\` \`;\` \`°\` \`)\` \`]\` \`}\``;

        if (!value) {
            return sock.sendMessage(from, { text: menuAyudaPrefijos }, { quoted: message });
        }

        // Filtro de caracteres permitidos
        const allowedChars = /^[\/\.~?,#!^%&<+\-×÷=:;°)\]}¡¿€£¥$¤₽●□■☆♤♡◇♧π√¢]+$/;
        if (!allowedChars.test(value)) {
            return sock.sendMessage(from, { text: `《✧》 Elija un prefijo válido.\n\n${menuAyudaPrefijos}` }, { quoted: message });
        }

        // Guardar los prefijos elegidos en la configuración del bot
        const prefijos = [...value].map(c => c);
        config.prefijo = prefijos;

        if (targetBotId === ownerBotId) {
            return sock.sendMessage(from, { text: `✿ *𝙎𝙝𝙖𝙙𝙤𝙬 𝙁𝙡𝙖𝙨𖤐⁩* | Se cambiaron los prefijos del bot actual a: *${value}*` }, { quoted: message });
        } else {
            return sock.sendMessage(from, { text: `✿ *𝙎𝙝𝙖𝙙𝙤𝙬 𝙁𝙡𝙖𝙨𖤐⁩* | Se cambiaron los prefijos del sub-bot ${targetBotId.split('@')[0]} a: *${value}*` }, { quoted: message });
        }
    }
};
