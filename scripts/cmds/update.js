const { exec } = require('child_process');
const { promisify } = require('util');
const { writeFileSync } = require('fs'); 
const path = require('path'); 

const execPromise = promisify(exec);

module.exports = {
    config: {
        name: "update",
        version: "1.0.0",
        author: "𝙎𝙝𝙖𝙙𝙤𝙬 𝙁𝙡𝙖𝙨𖤐⁩ / Adaptado",
        countDown: 5,
        role: 2, // 2 usualmente significa que SOLO el creador/owner del bot puede usarlo
        description: "Actualiza el bot desde GitHub por completo",
        category: "owner",
        guide: "{pn}"
    },

    onMessage: async function ({ message, args, sock }) {
        const from = message.key.remoteJid;

        try {
            // Reacción de "procesando"
            await sock.sendMessage(from, { react: { text: '🕑', key: message.key } });

            // Configurar Git local de forma segura
            await execPromise('git config user.email "bot@host.com"');
            await execPromise('git config user.name "HostBot"');
            
            // Buscar actualizaciones en GitHub
            await execPromise('git fetch origin');

            // Detectar la rama actual en la que está tu Termux
            const { stdout: branch } = await execPromise('git rev-parse --abbrev-ref HEAD');
            const currentBranch = branch.trim();

            // Ver diferencias y quién hizo el cambio
            const { stdout: diffStatus } = await execPromise(`git diff --name-status HEAD..origin/${currentBranch}`).catch(() => ({ stdout: '' }));
            const { stdout: info } = await execPromise(`git log HEAD..origin/${currentBranch} --format="%an" -1`).catch(() => ({ stdout: 'Desconocido' }));

            const lines = diffStatus.trim().split('\n').filter(line => line.trim() !== '');
            const totalFiles = lines.length;

            // Forzar la actualización descartando cambios locales que choquen
            await execPromise(`git reset --hard origin/${currentBranch}`);

            let changeList = lines.map(line => {
                const [status, ...fileParts] = line.split(/\s+/)
                const file = fileParts.join(' ')
                switch (status) {
                    case 'A': return `+ ${file}`;
                    case 'M': return `• ${file}`;
                    case 'D': return `- ${file}`;
                    default: return `? ${file}`;
                }
            }).slice(0, 20).join('\n');

            // Construir el mensaje de respuesta
            let msg = `❀ *Actualización Exitosa*\n\n`;
            msg += `亗 *Editor:* ${info.trim()}\n`;
            msg += `✎ *Total Cambios:* ${totalFiles}\n\n`;

            if (totalFiles > 0) {
                msg += `ꕥ *Detalles de archivos:*\n\`\`\`${changeList}${totalFiles > 20 ? '\n...entre otros.' : ''}\`\`\`\n\n`;
            } else {
                msg += `> *El bot ya se encuentra en su última versión.*\n\n`;
            }

            msg += `> *Reiniciando el bot, por favor espere...*`;

            // Enviar respuesta a WhatsApp
            await sock.sendMessage(from, { text: msg }, { quoted: message });
            await sock.sendMessage(from, { react: { text: '✅', key: message.key } });

            console.log(`\x1b[36m[UPDATE]\x1b[0m Bot actualizado con éxito. Reiniciando proceso...`);

            // Guardar chat de origen para que el bot avise al volver a encender
            const filePath = path.join(process.cwd(), 'restart_flag.txt');
            writeFileSync(filePath, from); 

            // Apagar el proceso. (Requiere pm2 o un script de reinicio automático para volver a prender solo)
            setTimeout(() => {
                process.exit(0);
            }, 3000);

        } catch (error) {
            console.error(error);
            await sock.sendMessage(from, { react: { text: '❌', key: message.key } });
            await sock.sendMessage(from, { text: `*⚠️ FALLO CRÍTICO EN UPDATE:* \n\n${error.message}` }, { quoted: message });
        }
    }
};
