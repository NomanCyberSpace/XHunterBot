const fs = require('fs');
const path = require('path');
const { getAntilink, setAntilink } = require('../lib/index');
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

async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        }

        if (!isSenderAdmin) {
            return await sock.sendMessage(chatId, { text: '❌ Only group admins can use this command.' }, { quoted: message });
        }

        const args = userMessage.trim().split(/\s+/);
        const action = (args[1] || '').toLowerCase();

        if (action === 'on' || action === 'enable') {
            await setAntilink(chatId, 'on', true);
            return await sock.sendMessage(chatId, { text: '🛡️ *Antilink protection is now ENABLED!*' }, { quoted: message });
        } else if (action === 'off' || action === 'disable') {
            await setAntilink(chatId, 'on', false);
            return await sock.sendMessage(chatId, { text: '🛡️ *Antilink protection is now DISABLED.*' }, { quoted: message });
        } else {
            return await sock.sendMessage(chatId, { text: '💡 *Usage:*\n• `.antilink on` - Enable link detection\n• `.antilink off` - Disable link detection' }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in handleAntilinkCommand:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to process antilink command.' }, { quoted: message });
    }
}

async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    try {
        if (!chatId || !chatId.endsWith('@g.us')) return;

        const antilinkConfig = await getAntilink(chatId, 'on');
        if (!antilinkConfig || !antilinkConfig.enabled) return;

        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        if (isSenderAdmin || !isBotAdmin) return;

        const strongLinkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(chat\.whatsapp\.com\/[^\s]+)|(wa\.me\/[^\s]+)|(t\.me\/[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|io|me|co|xyz|info|biz|tk|ml|ga|cf|gq)\b[^\s]*)/gi;

        if (strongLinkRegex.test(userMessage)) {
            try {
                await sock.sendMessage(chatId, { delete: message.key });
            } catch (err) {
                console.error("Failed to delete link message:", err.message);
            }

            let warnings = getWarnings();
            if (!warnings[chatId]) warnings[chatId] = {};
            if (!warnings[chatId][senderId]) warnings[chatId][senderId] = 0;

            warnings[chatId][senderId]++;
            const currentWarns = warnings[chatId][senderId];

            if (currentWarns < 3) {
                saveWarnings(warnings);
                await sock.sendMessage(chatId, {
                    text: `⚠️ *ANTILINK WARNING ALERT*\n\n👤 *User:* @${senderId.split('@')[0]}\n🚫 *Reason:* Link sharing is prohibited!\n⚠️ *Warnings:* ${currentWarns}/3`,
                    mentions: [senderId]
                });
            } else {
                delete warnings[chatId][senderId];
                saveWarnings(warnings);

                await sock.sendMessage(chatId, {
                    text: `🚨 *AUTO KICK ALERT*\n\n@${senderId.split('@')[0]} reached 3 warnings for sharing links and has been removed from the group!`,
                    mentions: [senderId]
                });

                try {
                    await sock.groupParticipantsUpdate(chatId, [senderId], "remove");
                } catch (kickErr) {
                    console.error("Failed to kick user:", kickErr.message);
                }
            }
        }
    } catch (error) {
        console.error("Error in handleLinkDetection:", error.message);
    }
}

module.exports = {
    handleAntilinkCommand,
    handleLinkDetection
};