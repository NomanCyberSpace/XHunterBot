const yts = require('yt-search');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363321458823123@newsletter',
            newsletterName: 'XHUNTERBOT MD',
            serverMessageId: -1
        }
    }
};

// Song / Mp3 Downloader Command
async function songCommand(sock, chatId, textQuery, message) {
    try {
        if (!textQuery) {
            return await sock.sendMessage(chatId, { 
                text: '❌ Please provide a song name or YouTube link!\nExample: `.song afsos`',
                ...channelInfo 
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { text: '🔍 *Searching song... Please wait!*' }, { quoted: message });

        const searchResult = await yts(textQuery);
        const video = searchResult.videos[0];

        if (!video) {
            return await sock.sendMessage(chatId, { text: '❌ No results found on YouTube!' }, { quoted: message });
        }

        const stream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
        const filePath = path.join(__dirname, `../temp/${Date.now()}.mp3`);

        const fileStream = fs.createWriteStream(filePath);
        stream.pipe(fileStream);

        fileStream.on('finish', async () => {
            await sock.sendMessage(chatId, {
                audio: { url: filePath },
                mimetype: 'audio/mp4',
                fileName: `${video.title}.mp3`,
                caption: `🎶 *Title:* ${video.title}\n⏱️ *Duration:* ${video.timestamp}\n🔗 *Link:* ${video.url}`,
                ...channelInfo
            }, { quoted: message });

            // Temp file deletion
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });

        stream.on('error', (err) => {
            console.error('YTDL Stream Error:', err);
            sock.sendMessage(chatId, { text: '❌ Failed to download audio. Try again later.' });
        });

    } catch (error) {
        console.error('Play/Song Error:', error);
        await sock.sendMessage(chatId, { text: '❌ Error processing song command!' }, { quoted: message });
    }
}

// Video / Mp4 Downloader Command
async function ytMp4Command(sock, chatId, textQuery, message) {
    try {
        if (!textQuery) {
            return await sock.sendMessage(chatId, { 
                text: '❌ Please provide a video name or link!\nExample: `.video afsos`',
                ...channelInfo 
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { text: '🎬 *Downloading video... Please wait!*' }, { quoted: message });

        const searchResult = await yts(textQuery);
        const video = searchResult.videos[0];

        if (!video) {
            return await sock.sendMessage(chatId, { text: '❌ No video found!' }, { quoted: message });
        }

        const stream = ytdl(video.url, { quality: '18' }); // 360p standard mp4
        const filePath = path.join(__dirname, `../temp/${Date.now()}.mp4`);

        const fileStream = fs.createWriteStream(filePath);
        stream.pipe(fileStream);

        fileStream.on('finish', async () => {
            await sock.sendMessage(chatId, {
                video: { url: filePath },
                caption: `🎬 *Title:* ${video.title}\n⏱️ *Duration:* ${video.timestamp}`,
                ...channelInfo
            }, { quoted: message });

            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });

    } catch (error) {
        console.error('YT Video Error:', error);
        await sock.sendMessage(chatId, { text: '❌ Error downloading video!' }, { quoted: message });
    }
}

module.exports = {
    songCommand,
    ytMp4Command
};