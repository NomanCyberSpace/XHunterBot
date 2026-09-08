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
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay,
    Browsers
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
                <h2>🤖 XHUNTERBOT is Connected or Generating QR...</h2>
                <p>Agar QR nahi dikh raha to page refresh karein.</p>
            </div>
        `);
    }

    try {
        const qrImage = await qrcode.toDataURL(latestQrData);
        res.send(`
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;font-family:sans-serif;">
                <h2>Scan QR with WhatsApp</h2>
                <p>Settings > Linked Devices > Link a Device</p>
                <img src="${qrImage}" style="width:300px;height:300px;border:2px solid #333;padding:10px;border-radius:8px;" />
                <script>setTimeout(() => location.reload(), 15000);</script>
            </div>
        `);
    } catch (err) {
        res.status(500).send('Error rendering QR Code');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(chalk.green(`🌐 Web Server running on port ${PORT}`));
});

const mongoose = require('mongoose');
const mongoUri = process.env.MONGODB_URL || (settings && settings.MONGODB_URL);

if (mongoUri) {
    mongoose.connect(mongoUri)
        .then(() => console.log(chalk.green('✅ MongoDB Connected Successfully!')))
        .catch((err) => console.error(chalk.red('❌ MongoDB Connection Error:'), err));
} else {
    console.log(chalk.yellow('⚠️ MONGODB_URL variable not set in environment or settings.'));
}

const store = require('./lib/lightweight_store');
store.readFromFile();
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000);

let isReconnecting = false;

async function startXeonBotInc() {
    if (isReconnecting) return;
    try {
        let { version } = await fetchLatestBaileysVersion();
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

        XeonBotInc.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect, qr } = s;

            if (qr) {
                latestQrData = qr;
                console.log(chalk.cyan('📱 Naya QR code web interface par available hai!'));
            }

            if (connection === 'connecting') {
                console.log(chalk.yellow('🔄 Connecting to WhatsApp...'));
            }

            if (connection === "open") {
                latestQrData = null;
                console.log(chalk.green(`🤖 Bot Connected Successfully! ✅`));
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;

                if (shouldReconnect) {
                    console.log(chalk.yellow('Reconnecting in 5 seconds...'));
                    await delay(5000);
                    startXeonBotInc();
                }
            }
        });

        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            try {
                const mek = chatUpdate.messages[0];
                if (!mek || !mek.message) return;
                await handleMessages(XeonBotInc, chatUpdate, true);
            } catch (err) {
                console.error("Error in handleMessages:", err);
            }
        });

        return XeonBotInc;
    } catch (error) {
        console.error('Error in startXeonBotInc:', error);
        await delay(5000);
        startXeonBotInc();
    }
}

startXeonBotInc();