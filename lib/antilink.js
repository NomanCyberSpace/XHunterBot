const fs = require('fs');
const path = require('path');
const { getAntilink } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

const databaseDir = path.join(process.cwd(), 'data');
const warningsPath = path.join(databaseDir, 'warnings.json');

function initializeWarningsFile() {
    if (!fs.existsSync(databaseDir)) fs.mkdirSync(databaseDir, { recursive: true });
    if (!fs.existsSync(warningsPath)) fs.writeFileSync(warningsPath, JSON.stringify({}), 'utf8');
}

async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    try {
        if (!chatId.endsWith('@g.us')) return;

        // Skip Admin or Owner check
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        if (isSenderAdmin || !isBotAdmin) return;

        const antilinkConfig = await getAntilink(chatId, 'on');
        if (!antilinkConfig || !antilinkConfig.enabled) return;

        // ULTRA STRONG LINK DETECTOR REGEX
        const strongLinkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(chat\.whatsapp\.com\/[^\s]+)|(wa\.me\/[^\s]+)|(t\.me\/[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|io|me|co|xyz|info|biz|tk|ml|ga|cf|gq)\b[^\s]*)/gi;

        const isLinkPresent = strongLinkRegex.test(userMessage);

        if (isLinkPresent) {
            const quotedMessageId = message.key.id;
            const quotedParticipant = message.key.participant || senderId;

            // 1. Delete Link Message Immediately
            try {
                await sock.sendMessage(chatId, {
                    delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant }
                });
            } catch (err) {
                console.error("Failed to delete link message:", err);
            }

            // 2. Warn User System
            initializeWarningsFile();
            let warnings = {};
            try {
                warnings = JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
            } catch (e) {
                warnings = {};
            }

            if (!warnings[chatId]) warnings[chatId] = {};
            if (!warnings[chatId][senderId]) warnings[chatId][senderId] = 0;

            warnings[chatId][senderId]++;
            fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));

            const currentWarns = warnings[chatId][senderId];

            if (currentWarns < 3) {
                await sock.sendMessage(chatId, {
                    text: `⚠️ *ANTILINK WARNING ALERT*\n\n👤 *User:* @${senderId.split('@')[0]}\n🚫 *Reason:* Posting Links is strictly prohibited!\n⚠️ *Warnings:* ${currentWarns}/3`,
                    mentions: [senderId]
                });
            } else {
                // 3. Auto Kick at 3 Warnings
                delete warnings[chatId][senderId];
                fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));

                await sock.sendMessage(chatId, {
                    text: `🚨 *AUTO KICK ALERT*\n\n@${senderId.split('@')[0]} reached 3 warnings for posting links and has been removed from the group!`,
                    mentions: [senderId]
                });

                await sock.groupParticipantsUpdate(chatId, [senderId], "remove");
            }
        }
    } catch (error) {
        console.error("Error in handleLinkDetection:", error);
    }
}

module.exports = {
    handleLinkDetection
};