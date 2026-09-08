/**
 * XHUNTERBOT - A WhatsApp Bot
 * Copyright (c) 2025 Noman
 */
const { File } = require('node:buffer');
globalThis.File = globalThis.File || File;

const settings = require('./settings');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const chalk = require('chalk');
const FileType = require('file-type');
const path = require('path');
const axios = require('axios');
const express = require('express');
const qrcode = require('qrcode');
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif');
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const pino = require("pino");

let latestQrData = null;

// ==========================================
// Express Web Server
// ==========================================
const app = express();
const PORT = process.env.PORT || 16239;

app.get('/', async (req, res) => {
    if (!latestQrData) {
        return res.send(`
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;font-family:sans-serif;">
                <h2 style="color:#25D366;">🤖 Bot Connected ya Standby Mode par hai</h2>
                <p>Agar WhatsApp connect ho chuka hai to QR code hide ho jata hai.</p>
            </div>
        `);
    }

    try {
        const qrImage = await qrcode.toDataURL(latestQrData);
        res.send(`
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;font-family:sans-serif;">
                <h2>Scan WhatsApp QR Code</h2>
                <img src="${qrImage}" style="width:320px;height:320px;border:3px solid #25D366;padding:10px;border-radius:12px;" />
                <p style="margin-top:15px;color:#666;">Page auto-reload hota rahega</p>
                <script>setTimeout(() => location.reload(), 10000);</script>
            </div>
        `);
    } catch (err) {
        res.status(500).send('Error rendering QR Code');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(chalk.green(`🌐 Web Server running on port ${PORT}`));
});

// MongoDB Setup
const mongoose = require('mongoose');
const mongoUri = process.env.MONGODB_URL || (settings && settings.MONGODB_URL);
if (mongoUri) {
    mongoose.connect(mongoUri)
        .then(() => console.log(chalk.green('✅ MongoDB Connected!')))
        .catch((err) => console.error(chalk.red('❌ MongoDB Error:'), err));
} else {
    console.log(chalk.yellow('⚠️ MONGODB_URL variable not set in environment or settings.'));
}

// Lightweight Store Setup
const store = require('./lib/lightweight_store');
store.readFromFile();
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000);

// Memory Optimization
setInterval(() => {
    if (global.gc) {
        global.gc();
    }
}, 60_000);

setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024;
    if (used > 450) {
        console.log('⚠️ RAM usage high (>450MB), restarting worker...');
        process.exit(1);
    }
}, 30_000);

let sock = null;
let isReconnecting = false;

async function startXeonBotInc() {
    if (isReconnecting) return;
    try {
        let { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        const msgRetryCounterCache = new NodeCache();

        sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 90000,
            connectTimeoutMs: 90000,
            keepAliveIntervalMs: 15000,
            emitOwnEvents: false,
            fireInitQueries: true
        });

        sock.ev.on('creds.update', saveCreds);
        store.bind(sock.ev);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                latestQrData = qr;
                console.log(chalk.cyan('📱 Naya QR code web interface par available hai!'));
            }

            if (connection === 'connecting') {
                console.log(chalk.yellow('🔄 Connecting to WhatsApp...'));
            }

            if (connection === 'open') {
                isReconnecting = false;
                latestQrData = null;
                console.log(chalk.green('🤖 Bot Connected Successfully! ✅'));
            }

            if (connection === 'close') {
                latestQrData = null;
                const statusCode = (new Boom(lastDisconnect?.error))?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || '';
                const isConflict = errorMessage.includes('conflict') || statusCode === 440;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;

                console.log(chalk.red(`Connection closed (${errorMessage || statusCode || 'Unknown'}). Reconnecting: ${shouldReconnect}`));

                if (isConflict) {
                    console.log(chalk.red('⚠️ Stream Conflict! Socket release hone ka intezaar... (15 seconds)'));
                    try { sock.ws?.close(); } catch (e) {}
                    if (!isReconnecting) {
                        isReconnecting = true;
                        setTimeout(() => {
                            isReconnecting = false;
                            startXeonBotInc();
                        }, 15000);
                    }
                    return;
                }

                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    console.log(chalk.red('Session expired ho chuka hai. Session folder clear karke dobara scan karein.'));
                    return;
                }

                if (shouldReconnect && !isReconnecting) {
                    isReconnecting = true;
                    console.log(chalk.yellow('Reconnecting in 5 seconds...'));
                    setTimeout(() => {
                        isReconnecting = false;
                        startXeonBotInc();
                    }, 5000);
                }
            }
        });

        // Messages Upsert Handler
        sock.ev.on('messages.upsert', async chatUpdate => {
            try {
                const mek = chatUpdate.messages[0];
                if (!mek || !mek.message) return;
                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;

                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    await handleStatus(sock, chatUpdate);
                    return;
                }

                if (mek.key.id && mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

                if (sock?.msgRetryCounterCache) {
                    sock.msgRetryCounterCache.clear();
                }

                try {
                    await handleMessages(sock, chatUpdate, true);
                } catch (err) {
                    console.error("Error in handleMessages:", err);
                }
            } catch (err) {
                console.error("Error in messages.upsert:", err);
            }
        });

        // Anticall Handling
        const antiCallNotified = new Set();
        sock.ev.on('call', async (calls) => {
            try {
                const { readState: readAnticallState } = require('./commands/anticall');
                const state = readAnticallState();
                if (!state.enabled) return;
                for (const call of calls) {
                    const callerJid = call.from || call.peerJid || call.chatId;
                    if (!callerJid) continue;
                    try {
                        if (typeof sock.rejectCall === 'function' && call.id) {
                            await sock.rejectCall(call.id, callerJid);
                        }
                    } catch {}

                    if (!antiCallNotified.has(callerJid)) {
                        antiCallNotified.add(callerJid);
                        setTimeout(() => antiCallNotified.delete(callerJid), 60000);
                        await sock.sendMessage(callerJid, { text: '📵 Anticall is enabled. Call rejected.' });
                    }
                    setTimeout(async () => {
                        try { await sock.updateBlockStatus(callerJid, 'block'); } catch {}
                    }, 800);
                }
            } catch (e) {}
        });

        sock.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(sock, update);
        });

        sock.ev.on('status.update', async (status) => {
            await handleStatus(sock, status);
        });

        return sock;
    } catch (error) {
        console.error('Error in startXeonBotInc:', error);
        isReconnecting = false;
        setTimeout(() => startXeonBotInc(), 5000);
    }
}

startXeonBotInc().catch(err => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.message || err);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});