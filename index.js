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
                <h2>🤖 Bot Status: Online ya QR generate ho raha hai...</h2>
                <p>Agar QR nahi dikh raha to 5 second baad page reload karein.</p>
            </div>
        `);
    }

    try {
        const qrImage = await qrcode.toDataURL(latestQrData);
        res.send(`
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;font-family:sans-serif;">
                <h2>Scan QR Code</h2>
                <img src="${qrImage}" style="width:300px;height:300px;border:2px solid #25D366;padding:10px;border-radius:12px;" />
                <p style="margin-top:15px;color:#666;">Page 10 seconds mein auto-reload hoga</p>
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

const mongoose = require('mongoose');
const mongoUri = process.env.MONGODB_URL || (settings && settings.MONGODB_URL);
if (mongoUri) {
    mongoose.connect(mongoUri)
        .then(() => console.log(chalk.green('✅ MongoDB Connected!')))
        .catch((err) => console.error(chalk.red('❌ MongoDB Error:'), err));
}

const store = require('./lib/lightweight_store');
store.readFromFile();
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000);

let sock = null;

async function startXeonBotInc() {
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
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
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
                latestQrData = null;
                console.log(chalk.green('🤖 Bot Connected Successfully! ✅'));
            }

            if (connection === 'close') {
                latestQrData = null;
                const statusCode = (new Boom(lastDisconnect?.error))?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(chalk.red(`Connection closed. Reason Code: ${statusCode}. Reconnecting: ${shouldReconnect}`));

                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(chalk.red('Device logged out. Session folder delete karein aur dobara scan karein.'));
                    return;
                }

                if (shouldReconnect) {
                    console.log(chalk.yellow('Reconnecting in 5 seconds...'));
                    setTimeout(() => startXeonBotInc(), 5000);
                }
            }
        });

        sock.ev.on('messages.upsert', async chatUpdate => {
            try {
                const mek = chatUpdate.messages[0];
                if (!mek || !mek.message) return;
                await handleMessages(sock, chatUpdate, true);
            } catch (err) {
                console.error("Error in handleMessages:", err);
            }
        });

        return sock;
    } catch (error) {
        console.error('Error in startXeonBotInc:', error);
        setTimeout(() => startXeonBotInc(), 5000);
    }
}

startXeonBotInc();