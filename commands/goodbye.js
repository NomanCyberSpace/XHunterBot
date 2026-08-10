const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

const databaseDir = path.join(process.cwd(), 'data');
const goodbyePath = path.join(databaseDir, 'goodbye.json');

function getGoodbyeData() {
    try {
        if (!fs.existsSync(databaseDir)) fs.mkdirSync(databaseDir, { recursive: true });
        if (!fs.existsSync(goodbyePath)) fs.writeFileSync(goodbyePath, JSON.stringify({}), 'utf8');
        return JSON.parse(fs.readFileSync(goodbyePath, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveGoodbyeData(data) {
    try {
        if (!fs.existsSync(databaseDir)) fs.mkdirSync(databaseDir, { recursive: true });
        fs.writeFileSync(goodbyePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error("Failed to save goodbye data:", e);
    }
}

async function goodbyeCommand(sock, chatId, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        }

        const senderId = message.key.participant || message.key.remoteJid;
        const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isSenderAdmin) {
            return await sock.sendMessage(chatId, { text: '❌ Only group admins can toggle goodbye messages.' }, { quoted: message });
        }

        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = rawText.trim().split(/\s+/);
        const option = (args[1] || '').toLowerCase();

        let data = getGoodbyeData();
        if (!data[chatId]) data[chatId] = { enabled: false };

        if (option === 'on' || option === 'enable') {
            data[chatId].enabled = true;
            saveGoodbyeData(data);
            return await sock.sendMessage(chatId, { text: '✅ *Goodbye messages are now ENABLED for this group!*' }, { quoted: message });
        }

        if (option === 'off' || option === 'disable') {
            data[chatId].enabled = false;
            saveGoodbyeData(data);
            return await sock.sendMessage(chatId, { text: '❌ *Goodbye messages are now DISABLED for this group.*' }, { quoted: message });
        }

        const currentStatus = data[chatId].enabled ? 'ENABLED 🟢' : 'DISABLED 🔴';
        await sock.sendMessage(chatId, { 
            text: `⚙️ *GOODBYE SETTINGS*\n\n📌 *Status:* ${currentStatus}\n\n💡 *Usage:*\n• \`.goodbye on\` - Turn ON\n• \`.goodbye off\` - Turn OFF` 
        }, { quoted: message });

    } catch (error) {
        console.error('Error in goodbyeCommand:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to update goodbye settings.' }, { quoted: message });
    }
}

async function handleLeaveEvent(sock, id, participants) {
    try {
        if (!id.endsWith('@g.us')) return;

        const data = getGoodbyeData();
        if (!data[id] || !data[id].enabled) return;

        for (const participant of participants) {
            const participantJid = typeof participant === 'string' ? participant : (participant.id || participant.toString());
            const userNumber = participantJid.split('@')[0];

            const goodbyeText = `Goodbye... +${userNumber}\nwe will miss you`;

            await sock.sendMessage(id, {
                text: goodbyeText,
                mentions: [participantJid]
            });
        }
    } catch (error) {
        console.error('Error in handleLeaveEvent:', error.message);
    }
}

module.exports = { goodbyeCommand, handleLeaveEvent };