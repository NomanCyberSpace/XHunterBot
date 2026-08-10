const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

const databaseDir = path.join(process.cwd(), 'data');
const welcomePath = path.join(databaseDir, 'welcome.json');

function getWelcomeData() {
    try {
        if (!fs.existsSync(databaseDir)) fs.mkdirSync(databaseDir, { recursive: true });
        if (!fs.existsSync(welcomePath)) fs.writeFileSync(welcomePath, JSON.stringify({}), 'utf8');
        return JSON.parse(fs.readFileSync(welcomePath, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveWelcomeData(data) {
    try {
        if (!fs.existsSync(databaseDir)) fs.mkdirSync(databaseDir, { recursive: true });
        fs.writeFileSync(welcomePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error("Failed to save welcome data:", e);
    }
}

async function welcomeCommand(sock, chatId, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        }

        const senderId = message.key.participant || message.key.remoteJid;
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isSenderAdmin) {
            return await sock.sendMessage(chatId, { text: '❌ Only group admins can toggle welcome messages.' }, { quoted: message });
        }

        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = rawText.trim().split(/\s+/);
        const option = (args[1] || '').toLowerCase();

        let data = getWelcomeData();
        if (!data[chatId]) data[chatId] = { enabled: false };

        if (option === 'on' || option === 'enable') {
            data[chatId].enabled = true;
            saveWelcomeData(data);
            return await sock.sendMessage(chatId, { text: '✅ *Welcome messages are now ENABLED for this group!*' }, { quoted: message });
        }

        if (option === 'off' || option === 'disable') {
            data[chatId].enabled = false;
            saveWelcomeData(data);
            return await sock.sendMessage(chatId, { text: '❌ *Welcome messages are now DISABLED for this group.*' }, { quoted: message });
        }

        const currentStatus = data[chatId].enabled ? 'ENABLED 🟢' : 'DISABLED 🔴';
        await sock.sendMessage(chatId, { 
            text: `⚙️ *WELCOME SETTINGS*\n\n📌 *Status:* ${currentStatus}\n\n💡 *Usage:*\n• \`.welcome on\` - Turn ON\n• \`.welcome off\` - Turn OFF` 
        }, { quoted: message });

    } catch (error) {
        console.error('Error in welcomeCommand:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to update welcome settings.' }, { quoted: message });
    }
}

async function handleJoinEvent(sock, id, participants) {
    try {
        if (!id.endsWith('@g.us')) return;

        const data = getWelcomeData();
        if (!data[id] || !data[id].enabled) return;

        let groupMetadata = null;
        try {
            groupMetadata = await sock.groupMetadata(id);
        } catch (e) {}

        const groupName = groupMetadata?.subject || 'the group';

        for (const participant of participants) {
            const participantJid = typeof participant === 'string' ? participant : (participant.id || participant.toString());
            
            const welcomeText = `Welcome to group ${groupName} @${participantJid.split('@')[0]}\nyou are precious to us`;

            await sock.sendMessage(id, {
                text: welcomeText,
                mentions: [participantJid]
            });
        }
    } catch (error) {
        console.error('Error in handleJoinEvent:', error.message);
    }
}

module.exports = { welcomeCommand, handleJoinEvent };