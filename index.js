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
    delay,
    Browsers
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const pino = require("pino");

let latestQrData = null;
let generatedPairingCode = null;
let botNumber = process.env.BOT_NUMBER || (settings && settings.botNumber) || ""; 
const SESSION_DIR = path.join(__dirname, 'session');

// ==========================================
// Express Web Server
// ==========================================
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const PORT = process.env.PORT || 16239;

app.get('/', async (req, res) => {
    if (sock?.user) {
        return res.send(`
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;font-family:sans-serif;">
                <h2 style="color:#25D366;">🤖 Bot Connected Successfully!</h2>
                <p>JID: ${sock.user.id}</p>
            </div>
        `);
    }

    let qrHtml = '';
    if (latestQrData) {
        try {
            const qrImage = await qrcode.toDataURL(latestQrData);
            qrHtml = `
                <h3>Option 1: Scan QR</h3>
                <img src="${qrImage}" style="width:250px;height:250px;border:2px solid #25D366;border-radius:8px;" />
            `;
        } catch (e) {}
    }

    res.send(`
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:90vh;font-family:sans-serif;text-align:center;">
            <h2>XHunterBot Link Portal</h2>
            ${generatedPairingCode ? `
                <div style="background:#e7f8ee;padding:15px 30px;border-radius:10px;border:2px solid #25D366;margin:15px 0;">
                    <h3>Pairing Code:</h3>
                    <h1 style="letter-spacing:5px;color:#075e54;font-size:32px;">${generatedPairingCode}</h1>
                    <p style="color:#555;">WhatsApp > Linked Devices > Link with phone number instead</p>
                </div>
            ` : `
                <div style="margin:20px 0;background:#f9f9f9;padding:20px;border-radius:10px;border:1px solid #ddd;">
                    <h3>Option: Link via Pairing Code</h3>
                    <form action="/pair" method="POST">
                        <input type="text" name="number" placeholder="e.g. 923001234567" style="padding:10px;font-size:16px;border-radius:5px;border:1px solid #ccc;" required />
                        <button type="submit" style="padding:10px 20px;font-size:16px;background:#25D366;color:#fff;border:none;border-radius:5px;cursor:pointer;">Get Code</button>
                    </form>
                </div>
            `}
            ${qrHtml}
            <script>setTimeout(() => { if (!${!!generatedPairingCode}) location.reload(); }, 12000);</script>
        </div>
    `);
});

app.post('/pair', async (req, res) => {
    let num = req.body.number.replace(/[^0-9]/g, '');
    if (!num) return res.redirect('/');
    botNumber = num;
    if (sock && !sock.authState.creds.registered) {
        try {
            await delay(1500);
            let code = await sock.requestPairingCode(botNumber);
            generatedPairingCode = code?.match(/.{1,4}/g)?.join('-') || code;
            console.log(chalk.green(`🔑 Pairing Code generated: ${generatedPairingCode}`));
        } catch (err) {
            console.error('Error requesting pairing code:', err);
        }
    }
    res.redirect('/');
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
    if (global.gc) global.gc();
}, 60_000);

let sock = null;
let isReconnecting = false;

function cleanSession() {
    try {
        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            console.log(chalk.yellow('🧹 Session cleared cleanly.'));
        }
    } catch (err) {
        console.error('Session clean error:', err);
    }
}

async function startXeonBotInc() {
    if (isReconnecting) return;
    try {
        if (sock?.ws) {
            try { sock.ws.close(); } catch (_) {}
            sock = null;
        }

        let { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        const msgRetryCounterCache = new NodeCache();

        sock = makeWASocket({
            version,
            logger: pino({ level: 'fatal' }),
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
            },
            markOnlineOnConnect: false,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            emitOwnEvents: false,
            fireInitQueries: false
        });

        // Pairing Code Handler for headless servers
        if (botNumber && !sock.authState.creds.registered) {
            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(botNumber);
                    generatedPairingCode = code?.match(/.{1,4}/g)?.join('-') || code;
                    console.log(chalk.green(`\n🔑 WA PAIRING CODE: ${generatedPairingCode}\n`));
                } catch (e) {
                    console.log(chalk.red('Pairing code generation failed:'), e.message);
                }
            }, 3000);
        }

        sock.ev.on('creds.update', saveCreds);
        store.bind(sock.ev);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && !botNumber) {
                latestQrData = qr;
                console.log(chalk.cyan('📱 Naya QR code web interface par available hai!'));
            }

            if (connection === 'connecting') {
                console.log(chalk.yellow('🔄 Connecting to WhatsApp...'));
            }

            if (connection === 'open') {
                isReconnecting = false;
                latestQrData = null;
                generatedPairingCode = null;
                console.log(chalk.green('🤖 Bot Connected Successfully! ✅'));
            }

            if (connection === 'close') {
                latestQrData = null;
                const statusCode = (new Boom(lastDisconnect?.error))?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || '';
                const isSignatureError = errorMessage.toLowerCase().includes('signature');
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401 && !isSignatureError;

                console.log(chalk.red(`Connection closed (${errorMessage || statusCode || 'Unknown'}). Reconnecting: ${shouldReconnect}`));

                if (isSignatureError || statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    cleanSession();
                    if (!isReconnecting) {
                        isReconnecting = true;
                        setTimeout(() => {
                            isReconnecting = false;
                            startXeonBotInc();
                        }, 3000);
                    }
                    return;
                }

                if (shouldReconnect && !isReconnecting) {
                    isReconnecting = true;
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