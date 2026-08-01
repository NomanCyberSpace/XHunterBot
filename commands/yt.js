const yts = require('yt-search');
const axios = require('axios');

const RAPID_HEADERS = {
    'x-rapidapi-key': '1448ef7463msh769afae00da1a97p10823djsnbcc28cdffff6',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
};

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

// Song / Mp3 Downloader Command (RapidAPI Supported)
async function songCommand(sock, chatId, textQuery, message) {
    try {
        if (!textQuery) {
            return await sock.sendMessage(chatId, { 
                text: '❌ Please provide a song name or YouTube link!\nExample: `.song afsos`',
                ...channelInfo 
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { text: '🎵 *Searching & downloading audio...*' }, { quoted: message });

        const searchResult = await yts(textQuery);
        const video = searchResult.videos?.[0];

        if (!video) {
            return await sock.sendMessage(chatId, { text: '❌ No results found on YouTube!' }, { quoted: message });
        }

        let audioUrl = null;

        // Method 1: RapidAPI YT MP3 (Screenshot API)
        try {
            const res = await axios.get('https://yt-search-and-download-mp3.p.rapidapi.com/mp3', {
                params: { id: video.videoId, url: video.url },
                headers: {
                    ...RAPID_HEADERS,
                    'x-rapidapi-host': 'yt-search-and-download-mp3.p.rapidapi.com'
                },
                timeout: 20000
            });
            audioUrl = res.data?.link || res.data?.downloadUrl || res.data?.url;
        } catch (err) {
            console.log('RapidAPI MP3 failed, trying fallback...');
        }

        // Method 2: Yupra API Fallback
        if (!audioUrl) {
            try {
                const res2 = await axios.get(`https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(video.url)}`, { timeout: 15000 });
                if (res2.data?.success && res2.data?.data?.download_url) {
                    audioUrl = res2.data.data.download_url;
                }
            } catch (err2) {}
        }

        if (!audioUrl) {
            throw new Error('All audio download sources failed');
        }

        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${video.title.replace(/[\\/:*?"<>|]/g, '')}.mp3`,
            caption: `🎶 *Title:* ${video.title}\n⏱️ *Duration:* ${video.timestamp}\n🔗 *Link:* ${video.url}`,
            ...channelInfo
        }, { quoted: message });

    } catch (error) {
        console.error('Play/Song Error:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Error processing song command! API down.' }, { quoted: message });
    }
}

// Video / Mp4 Downloader Command (RapidAPI Supported)
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
        const video = searchResult.videos?.[0];

        if (!video) {
            return await sock.sendMessage(chatId, { text: '❌ No video found!' }, { quoted: message });
        }

        let videoUrl = null;

        // RapidAPI Social Media Video Downloader for MP4
        try {
            const res = await axios.get('https://social-media-video-downloader.p.rapidapi.com/youtube/v3/video/details', {
                params: { videoId: video.videoId, urlAccess: 'normal' },
                headers: {
                    ...RAPID_HEADERS,
                    'x-rapidapi-host': 'social-media-video-downloader.p.rapidapi.com'
                },
                timeout: 20000
            });
            if (res.data?.formats && Array.isArray(res.data.formats)) {
                const mp4Format = res.data.formats.find(f => f.url && f.ext === 'mp4');
                videoUrl = mp4Format?.url || res.data.formats[0]?.url;
            } else if (res.data?.downloadUrl) {
                videoUrl = res.data.downloadUrl;
            }
        } catch (err) {
            console.log('RapidAPI Video failed');
        }

        if (!videoUrl) {
            throw new Error('Video download source failed');
        }

        await sock.sendMessage(chatId, {
            video: { url: videoUrl },
            mimetype: 'video/mp4',
            caption: `🎬 *Title:* ${video.title}\n⏱️ *Duration:* ${video.timestamp}`,
            ...channelInfo
        }, { quoted: message });

    } catch (error) {
        console.error('YT Video Error:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Error downloading video!' }, { quoted: message });
    }
}

module.exports = {
    songCommand,
    ytMp4Command
};