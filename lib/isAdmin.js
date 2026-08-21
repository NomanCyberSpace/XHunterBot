async function isAdmin(sock, chatId, senderId) {
    try {
        if (!chatId || !chatId.endsWith('@g.us')) {
            return { isSenderAdmin: false, isBotAdmin: false };
        }

        // Fresh metadata fetch without broken cache
        let metadata = null;
        try {
            metadata = await sock.groupMetadata(chatId);
        } catch (e) {
            console.error('❌ Failed to fetch group metadata in isAdmin:', e.message);
            return { isSenderAdmin: false, isBotAdmin: false };
        }

        const participants = metadata?.participants || [];
        if (!participants.length) {
            return { isSenderAdmin: false, isBotAdmin: false };
        }

        // Bot phone & pure digits extract
        const rawBotId = sock.user?.id || '';
        const rawBotLid = sock.user?.lid || '';
        const botDigits = rawBotId.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        const botLidDigits = rawBotLid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');

        // Sender phone & pure digits extract
        const rawSenderId = senderId || '';
        const senderDigits = rawSenderId.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');

        let isBotAdmin = false;
        let isSenderAdmin = false;

        for (const p of participants) {
            const hasAdminRights = p.admin === 'admin' || p.admin === 'superadmin';
            if (!hasAdminRights) continue;

            const pId = p.id || '';
            const pLid = p.lid || '';
            const pDigits = pId.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
            const pLidDigits = pLid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
            const pPhoneDigits = (p.phoneNumber || '').replace(/[^0-9]/g, '');

            // 1. Bot Admin Match
            if (!isBotAdmin) {
                if (
                    (botDigits && (pDigits === botDigits || pPhoneDigits === botDigits)) ||
                    (botLidDigits && (pLidDigits === botLidDigits || pDigits === botLidDigits)) ||
                    pId === rawBotId ||
                    pLid === rawBotLid
                ) {
                    isBotAdmin = true;
                }
            }

            // 2. Sender Admin Match
            if (!isSenderAdmin) {
                if (
                    (senderDigits && (pDigits === senderDigits || pLidDigits === senderDigits || pPhoneDigits === senderDigits)) ||
                    pId === rawSenderId ||
                    pLid === rawSenderId
                ) {
                    isSenderAdmin = true;
                }
            }

            if (isBotAdmin && isSenderAdmin) break;
        }

        return { isSenderAdmin, isBotAdmin };
    } catch (err) {
        console.error('❌ Error in isAdmin:', err.message);
        return { isSenderAdmin: false, isBotAdmin: false };
    }
}

module.exports = isAdmin;