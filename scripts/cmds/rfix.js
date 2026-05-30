/*
Creador: 𝙎𝙝𝙖𝙙𝙤𝙬 𝙁𝙡𝙖𝙨𖤐⁩
Comando: Actualización Forzada y Reinicio Seguro
*/

const { exec } = require('child_process');
const { promisify } = require('util');
const { writeFileSync } = require('fs'); 
const path = require('path'); 

const execPromise = promisify(exec);

module.exports = {
    config: {
        name: "rfix",
        version: "1.0.5",
        author: "𝙎𝙝𝙖𝙙𝙤𝙬 𝙁𝙡𝙖𝙨𖤐⁩",
        countDown: 3,
        role: 2, // 2 = Solo el Owner/Creador del bot puede usarlo
        description: "Fuerza una limpieza, actualización de Git y reinicia el proceso",
        category: "owner",
        guide: "{pn}"
    },

    onMessage: async function ({ message, args, sock }) {
        const from = message.key.remoteJid;

        try {
            // Reacción de advertencia/procesando
            await sock.sendMessage(from, { react: { text: '⚙️', key: message.key } });

            // Mensaje inicial en WhatsApp
            await sock.sendMessage(from, { 
                text: `🛠️ *Fijando y Forzando Actualización...*\n\n> Iniciando limpieza de caché local, descarga forzada desde GitHub y restauración del sistema. Por favor, no envíes comandos.` 
            }, { quoted: message });

            // 1. Configuración interna de Git limpia
            await execPromise('git config user.email "shadow@flash.com"');
            await execPromise('git config user.name "ShadowFlash"');

            // 2. Traer los datos frescos del repositorio origen
            await execPromise('git fetch --all');

            // 3. Detectar la rama activa (ej. main o master)
            const { stdout: branch } = await execPromise('git rev-parse --abbrev-ref HEAD');
            const currentBranch = branch.trim();

            // 4. EL TRUCO DE OBLIGACIÓN: Borra cualquier cambio local que cause conflicto y se acopla al GitHub
            await execPromise(`git reset --hard origin/${currentBranch}`);
            await execPromise('git clean -fd'); // Elimina archivos basura o sueltos que no estén en GitHub

            // Mensaje de éxito previo al apagado
            let msg = `❀ *Sistema Restaurado con Éxito*\n\n`;
            msg += `亗 *Creador:* 𝙎𝙝𝙖𝙙𝙤𝙬 𝙁𝙡𝙖𝙨𖤐⁩\n`;
            msg += `🔧 *Estado:* Archivos locales alineados con GitHub.\n\n`;
            msg += `> *Reiniciando los módulos, volviendo en línea...*`;

            await sock.sendMessage(from, { text: msg }, { quoted: message });
            await sock.sendMessage(from, { react: { text: '✅', key: message.key } });

            console.log(`\x1b[31m[RFIX]\x1b[0m Reseteado por completo por Shadow Flash. Saliendo del proceso...`);

            // 5. Crear el archivo temporal para recordar el chat al encender
            const filePath = path.join(process.cwd(), 'restart_flag.txt');
            writeFileSync(filePath, from); 

            // 6. Forzar cierre del bot para que el gestor de Termux lo reviva limpio
            setTimeout(() => {
                process.exit(0);
            }, 2500);

        } catch (error) {
            console.error(error);
            await sock.sendMessage(from, { react: { text: '❌', key: message.key } });
            await sock.sendMessage(from, { text: `*⚠️ ERROR CRÍTICO EN RFIX:* \n\n${error.message}` }, { quoted: message });
        }
    }
};
