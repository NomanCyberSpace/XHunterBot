const fs = require('fs');
const path = require('path');

const databaseDir = path.join(process.cwd(), 'data');
const warningsPath = path.join(databaseDir, 'warnings.json');

function loadWarnings() {
    try {
        if (!fs.existsSync(databaseDir)) fs.mkdirSync(databaseDir, { recursive: true });
        if (!fs.existsSync(warningsPath)) fs.writeFileSync(warningsPath, JSON.stringify({}), 'utf8');
        return JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
    } catch (e) {
        return {};
    }
}

async function warningsCommand(sock, chatId, message, mentionedJids) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        }

        let userToCheck = null;

        // Check mentioned user, replied user, or default to sender
        if (mentionedJids && mentionedJids.length > 0) {
            userToCheck = mentionedJids[0];
        } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToCheck = message.message.extendedTextMessage.contextInfo.participant;
        } else {
            userToCheck = message.key.participant || message.key.remoteJid;
        }

        const warnings = loadWarnings();
        const warningCount = warnings[chatId]?.[userToCheck] || 0;

        const responseText = `📋 *WARNING STATUS*\n\n` +
                             `👤 *User:* @${userToCheck.split('@')[0]}\n` +
                             `⚠️ *Warnings:* ${warningCount}/3`;

        await sock.sendMessage(chatId, {
            text: responseText,
            mentions: [userToCheck]
        }, { quoted: message });

    } catch (error) {
        console.error('Error in warningsCommand:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch warning count.' }, { quoted: message });
    }
}

module.exports = warningsCommand;