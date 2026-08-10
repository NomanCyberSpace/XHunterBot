const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

const databaseDir = path.join(process.cwd(), 'data');
const warningsPath = path.join(databaseDir, 'warnings.json');

function getWarnings() {
    try {
        if (!fs.existsSync(databaseDir)) fs.mkdirSync(databaseDir, { recursive: true });
        if (!fs.existsSync(warningsPath)) fs.writeFileSync(warningsPath, JSON.stringify({}), 'utf8');
        return JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveWarnings(data) {
    try {
        if (!fs.existsSync(databaseDir)) fs.mkdirSync(databaseDir, { recursive: true });
        fs.writeFileSync(warningsPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error("Failed to save warnings:", e);
    }
}

async function warnCommand(sock, chatId, senderId, mentionedJids, message) {
    try {
        if (!chatId || !chatId.endsWith('@g.us')) {
            return await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups!' }, { quoted: message });
        }

        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isBotAdmin) {
            return await sock.sendMessage(chatId, { text: '❌ Make the bot an admin first to use this command.' }, { quoted: message });
        }

        if (!isSenderAdmin) {
            return await sock.sendMessage(chatId, { text: '❌ Only group admins can use the warn command.' }, { quoted: message });
        }

        let userToWarn = null;
        if (mentionedJids && mentionedJids.length > 0) {
            userToWarn = mentionedJids[0];
        } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToWarn = message.message.extendedTextMessage.contextInfo.participant;
        }

        if (!userToWarn) {
            return await sock.sendMessage(chatId, { text: '❌ Mention a user or reply to their message to warn!' }, { quoted: message });
        }

        // Prevent warning admins
        const targetAdminCheck = await isAdmin(sock, chatId, userToWarn);
        if (targetAdminCheck.isSenderAdmin) {
            return await sock.sendMessage(chatId, { text: '❌ You cannot warn a group admin!' }, { quoted: message });
        }

        let warnings = getWarnings();
        if (!warnings[chatId]) warnings[chatId] = {};
        if (!warnings[chatId][userToWarn]) warnings[chatId][userToWarn] = 0;

        warnings[chatId][userToWarn]++;
        const currentWarns = warnings[chatId][userToWarn];

        if (currentWarns < 3) {
            saveWarnings(warnings);
            const warningMessage = `⚠️ *MANUAL WARNING ALERT*\n\n` +
                `👤 *Warned User:* @${userToWarn.split('@')[0]}\n` +
                `⚠️ *Warning Count:* ${currentWarns}/3\n` +
                `👑 *Warned By:* @${senderId.split('@')[0]}\n\n` +
                `📅 *Date:* ${new Date().toLocaleDateString()}`;

            await sock.sendMessage(chatId, {
                text: warningMessage,
                mentions: [userToWarn, senderId]
            }, { quoted: message });
        } else {
            // Auto Kick at 3 Warnings
            delete warnings[chatId][userToWarn];
            saveWarnings(warnings);

            const kickMessage = `🚨 *AUTO-KICK ALERT*\n\n` +
                `@${userToWarn.split('@')[0]} reached 3 warnings and has been removed from the group! ⚠️`;

            await sock.sendMessage(chatId, {
                text: kickMessage,
                mentions: [userToWarn]
            });

            try {
                await sock.groupParticipantsUpdate(chatId, [userToWarn], "remove");
            } catch (kickErr) {
                console.error("Failed to kick user:", kickErr.message);
            }
        }

    } catch (error) {
        console.error('Error in warn command:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to process warn command.' }, { quoted: message });
    }
}

module.exports = warnCommand;