/**
 * XHUNTERBOT - A WhatsApp Bot
 * Copyright (c) 2025 Noman
 */
const { File } = require('node:buffer');
globalThis.File = globalThis.File || File;

// 1. Require Settings First!
const settings = require('./settings');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const chalk = require('chalk');
const FileType = require('file-type');
const path = require('path');
const axios = require('axios');
const express = require('express');
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif');
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const pino = require("pino");
const readline = require("readline");
const { parsePhoneNumber } = require("libphonenumber-js");
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics');
const { rmSync, existsSync } = require('fs');
const { join } = require('path');

// ==========================================
// Express Web Server
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.status(200).send('🤖 XHUNTERBOT is running 24/7!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(chalk.green(`🌐 Web Server running on port ${PORT}`));
});

// MongoDB Connection setup
const mongoose = require('mongoose');
const mongoUri = process.env.MONGODB_URL || (settings && settings.MONGODB_URL);

if (mongoUri) {
    mongoose.connect(mongoUri)
        .then(() => console.log(chalk.green('✅ MongoDB Connected Successfully!')))
        .catch((err) => console.error(chalk.red('❌ MongoDB Connection Error:'), err));
} else {
    console.log(chalk.yellow('⚠️ MONGODB_URL variable not set in environment or settings.'));
}

// Import lightweight store
const store = require('./lib/lightweight_store');

store.readFromFile();
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000);

// Memory optimization
setInterval(() => {
    if (global.gc) {
        global.gc();
        console.log('🧹 Garbage collection completed');
    }
}, 60_000);

setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024;
    if (used > 400) {
        console.log('⚠️ RAM too high (>400MB), restarting bot...');
        process.exit(1);
    }
}, 30_000);

let owner = JSON.parse(fs.readFileSync('./data/owner.json'));
global.botname = "XHUNTERBOT";
global.themeemoji = "•";

const usePairingCode = true;
const useMobile = process.argv.includes("--mobile");

// Readline setup for CLI Input
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startXeonBotInc() {
    try {
        let { version, isLatest } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        const msgRetryCounterCache = new NodeCache();

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid);
                let msg = await store.loadMessage(jid, key.id);
                return msg?.message || "";
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        });

        XeonBotInc.ev.on('creds.update', saveCreds);
        store.bind(XeonBotInc.ev);

        // Messages Handler
        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            try {
                const mek = chatUpdate.messages[0];
                if (!mek || !mek.message) return;
                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
                
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    await handleStatus(XeonBotInc, chatUpdate);
                    return;
                }

                if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                    const isGroup = mek.key?.remoteJid?.endsWith('@g.us');
                    if (!isGroup) return;
                }
                if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

                if (XeonBotInc?.msgRetryCounterCache) {
                    XeonBotInc.msgRetryCounterCache.clear();
                }

                try {
                    await handleMessages(XeonBotInc, chatUpdate, true);
                } catch (err) {
                    console.error("Error in handleMessages:", err);
                }
            } catch (err) {
                console.error("Error in messages.upsert:", err);
            }
        });

        XeonBotInc.decodeJid = (jid) => {
            if (!jid) return jid;
            if (/:\d+@/gi.test(jid)) {
                let decode = jidDecode(jid) || {};
                return decode.user && decode.server && decode.user + '@' + decode.server || jid;
            } else return jid;
        };

        XeonBotInc.ev.on('contacts.update', update => {
            for (let contact of update) {
                let id = XeonBotInc.decodeJid(contact.id);
                if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
            }
        });

        XeonBotInc.getName = (jid, withoutContact = false) => {
            id = XeonBotInc.decodeJid(jid);
            withoutContact = XeonBotInc.withoutContact || withoutContact;
            let v;
            if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
                v = store.contacts[id] || {};
                if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {};
                resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'));
            });
            else v = id === '0@s.whatsapp.net' ? {
                id,
                name: 'WhatsApp'
            } : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ?
                XeonBotInc.user :
                (store.contacts[id] || {});
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international');
        };

        XeonBotInc.public = true;
        XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store);

        // Pairing Code Safe Handling
        if (usePairingCode && !XeonBotInc.authState.creds.registered) {
            if (useMobile) throw new Error('Cannot use pairing code with mobile api');

            let userPhone = await question(chalk.bgBlack(chalk.greenBright(`\nPlease type your WhatsApp number 😍\nFormat: 923462809972 (without + or spaces) : `)));

            userPhone = userPhone.replace(/[^0-9]/g, '');
            const pn = require('awesome-phonenumber');
            if (!pn('+' + userPhone).isValid()) {
                console.log(chalk.red('❌ Invalid phone number. Please enter international format without + or spaces.'));
                process.exit(1);
            }

            console.log(chalk.yellow(`⏳ Requesting pairing code for +${userPhone}... Please wait.`));

            // Socket connect hone par pairing code request generate karein
            setTimeout(async () => {
                try {
                    let code = await XeonBotInc.requestPairingCode(userPhone);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(chalk.black(chalk.bgGreen(`\n🎉 YOUR PAIRING CODE FOR +${userPhone} : `)), chalk.bold.white(code), `\n`);
                    console.log(chalk.cyan(`👉 Open WhatsApp > Linked Devices > Link with phone number > Enter code: ${code}\n`));
                } catch (error) {
                    console.error('❌ Error requesting pairing code:', error.message || error);
                }
            }, 6000);
        }

        // Connection Handling
        XeonBotInc.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect, qr } = s;

            if (connection === 'connecting') {
                console.log(chalk.yellow('🔄 Connecting to WhatsApp...'));
            }

            if (connection === "open") {
                console.log(chalk.yellow(`🌿 Connected to => ` + JSON.stringify(XeonBotInc.user, null, 2)));

                try {
                    const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
                    await XeonBotInc.sendMessage(botNumber, {
                        text: `🤖 Bot Connected Successfully!\n\n⏰ Time: ${new Date().toLocaleString()}\n✅ Status: Online and Ready!`,
                    });
                } catch (error) {
                    console.error('Error sending connection message:', error.message);
                }

                await delay(1999);
                console.log(chalk.green(`🤖 Bot Connected Successfully! ✅`));
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;

                console.log(chalk.red(`Connection closed (${lastDisconnect?.error?.message || 'Unknown'}). Reconnecting: ${shouldReconnect}`));

                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    console.log(chalk.red('Session logged out or expired. Please delete session folder and re-link.'));
                }

                if (shouldReconnect) {
                    console.log(chalk.yellow('Reconnecting in 5 seconds...'));
                    await delay(5000);
                    startXeonBotInc();
                }
            }
        });

        // Anticall
        const antiCallNotified = new Set();
        XeonBotInc.ev.on('call', async (calls) => {
            try {
                const { readState: readAnticallState } = require('./commands/anticall');
                const state = readAnticallState();
                if (!state.enabled) return;
                for (const call of calls) {
                    const callerJid = call.from || call.peerJid || call.chatId;
                    if (!callerJid) continue;
                    try {
                        if (typeof XeonBotInc.rejectCall === 'function' && call.id) {
                            await XeonBotInc.rejectCall(call.id, callerJid);
                        }
                    } catch {}

                    if (!antiCallNotified.has(callerJid)) {
                        antiCallNotified.add(callerJid);
                        setTimeout(() => antiCallNotified.delete(callerJid), 60000);
                        await XeonBotInc.sendMessage(callerJid, { text: '📵 Anticall is enabled. Call rejected.' });
                    }
                    setTimeout(async () => {
                        try { await XeonBotInc.updateBlockStatus(callerJid, 'block'); } catch {}
                    }, 800);
                }
            } catch (e) {}
        });

        XeonBotInc.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(XeonBotInc, update);
        });

        XeonBotInc.ev.on('status.update', async (status) => {
            await handleStatus(XeonBotInc, status);
        });

        return XeonBotInc;
    } catch (error) {
        console.error('Error in startXeonBotInc:', error);
        await delay(5000);
        startXeonBotInc();
    }
}

// Start the bot
startXeonBotInc().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.message || err);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});