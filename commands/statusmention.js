const isAdmin = require('../lib/isAdmin');

async function handleStatusMentionDetection(sock, chatId, message, senderId) {
    try {
        if (!chatId || !chatId.endsWith('@g.us')) return;

        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const rawText = message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || '';

        // Detect Status Broadcast Mentions
        const isStatusMention = Boolean(
            message.message?.groupMentionedMessage || 
            contextInfo?.remoteJid === 'status@broadcast' ||
            contextInfo?.participant === 'status@broadcast' ||
            (contextInfo?.mentionedJid && contextInfo.mentionedJid.includes('status@broadcast')) ||
            rawText.includes('status@broadcast')
        );

        if (!isStatusMention) return;

        // Skip if sender is Admin or Bot is not Admin
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        if (isSenderAdmin || !isBotAdmin) return;

        // Silent Delete (No Warning)
        await sock.sendMessage(chatId, { delete: message.key });

    } catch (error) {
        console.error('Error in handleStatusMentionDetection:', error.message);
    }
}

module.exports = {
    handleStatusMentionDetection
};