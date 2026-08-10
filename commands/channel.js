const isAdmin = require('../lib/isAdmin');

async function handleChannelForwardDetection(sock, chatId, message, senderId) {
    try {
        if (!chatId || !chatId.endsWith('@g.us')) return;

        const contextInfo = message.message?.extendedTextMessage?.contextInfo ||
                            message.message?.imageMessage?.captionContextInfo ||
                            message.message?.videoMessage?.captionContextInfo;

        // Detect Channel / Newsletter Forwards
        const isChannelForward = Boolean(
            contextInfo?.forwardedNewsletterMessageInfo || 
            (contextInfo?.isForwarded && contextInfo?.forwardedNewsletterMessageInfo?.newsletterJid)
        );

        if (!isChannelForward) return;

        // Skip if sender is Admin or Bot is not Admin
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        if (isSenderAdmin || !isBotAdmin) return;

        // Silent Delete (No Warning)
        await sock.sendMessage(chatId, { delete: message.key });

    } catch (error) {
        console.error('Error in handleChannelForwardDetection:', error.message);
    }
}

module.exports = {
    handleChannelForwardDetection
};