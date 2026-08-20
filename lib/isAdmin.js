// In-Memory Group Metadata Cache (1 Minute TTL)
const groupCache = new Map();
const CACHE_TTL = 60 * 1000;

async function getGroupMetadataSafe(sock, chatId) {
    const cached = groupCache.get(chatId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }
    try {
        const metadata = await sock.groupMetadata(chatId);
        groupCache.set(chatId, { data: metadata, timestamp: Date.now() });
        return metadata;
    } catch (err) {
        if (cached?.data) return cached.data;
        throw err;
    }
}

async function isAdmin(sock, chatId, senderId) {
    try {
        if (!chatId || !chatId.endsWith('@g.us')) {
            return { isSenderAdmin: false, isBotAdmin: false };
        }

        const metadata = await getGroupMetadataSafe(sock, chatId);
        const participants = metadata?.participants || [];

        // Bot ke phone number aur pure digits extract karein
        const rawBotId = sock.user?.id || '';
        const rawBotLid = sock.user?.lid || '';
        const botPhone = rawBotId.split(':')[0].split('@')[0];
        const botLidNum = rawBotLid.split(':')[0].split('@')[0];

        // Sender ke phone number aur pure digits extract karein
        const rawSenderId = senderId || '';
        const senderPhone = rawSenderId.split(':')[0].split('@')[0];
        const senderPureId = rawSenderId.split('@')[0];

        let isBotAdmin = false;
        let isSenderAdmin = false;

        for (const p of participants) {
            const hasAdminRights = p.admin === 'admin' || p.admin === 'superadmin';
            if (!hasAdminRights) continue;

            const pFullId = p.id || '';
            const pFullLid = p.lid || '';
            const pPhone = pFullId.split(':')[0].split('@')[0];
            const pLidNum = pFullLid.split(':')[0].split('@')[0];
            const pPurePhone = p.phoneNumber ? p.phoneNumber.split('@')[0] : '';

            // Robust Bot Admin Check
            if (!isBotAdmin) {
                if (
                    (botPhone && (pPhone === botPhone || pPurePhone === botPhone)) ||
                    (botLidNum && (pLidNum === botLidNum || pPhone === botLidNum)) ||
                    pFullId === rawBotId ||
                    pFullLid === rawBotLid
                ) {
                    isBotAdmin = true;
                }
            }

            // Robust Sender Admin Check
            if (!isSenderAdmin) {
                if (
                    (senderPhone && (pPhone === senderPhone || pPurePhone === senderPhone)) ||
                    pFullId === rawSenderId ||
                    pFullLid === rawSenderId ||
                    pPureId === pPhone ||
                    pPureId === pLidNum
                ) {
                    isSenderAdmin = true;
                }
            }

            if (isBotAdmin && isSenderAdmin) break;
        }

        return { isSenderAdmin, isBotAdmin };
    } catch (err) {
        console.error('❌ Error checking admin status:', err.message);
        return { isSenderAdmin: false, isBotAdmin: false };
    }
}

module.exports = isAdmin;