const axios = require('axios');
const yts = require('yt-search');

const AXIOS_DEFAULTS = {
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function videoCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || 
                        message.message?.imageMessage?.caption || 
                        message.message?.videoMessage?.caption || '';

        const searchQuery = rawText.trim().split(/\s+/).slice(1).join(' ').trim();
        
        if (!searchQuery) {
            return await sock.sendMessage(chatId, { text: '❌ Please provide a video title or YouTube link!\nExample: `.video afsos` or `.video https://youtu.be/...`' }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🎬', key: message.key } });

        let videoUrl = '';
        let videoTitle = '';
        let videoThumbnail = '';

        // Check if query is URL or search keywords
        const isUrl = searchQuery.startsWith('http://') || searchQuery.startsWith('https://');

        if (isUrl) {
            videoUrl = searchQuery;
            const ytIdMatch = videoUrl.match(/(?:youtu\.be\/|v=|\/shorts\/)([a-zA-Z0-9_-]{11})/);
            if (ytIdMatch && ytIdMatch[1]) {
                videoThumbnail = `https://i.ytimg.com/vi/${ytIdMatch[1]}/hqdefault.jpg`;
            }
        } else {
            // Search via yt-search safely
            try {
                const searchRes = await yts(searchQuery);
                const videos = searchRes?.videos;
                if (!videos || videos.length === 0) {
                    return await sock.sendMessage(chatId, { text: '❌ No YouTube videos found for your search!' }, { quoted: message });
                }
                videoUrl = videos[0].url;
                videoTitle = videos[0].title;
                videoThumbnail = videos[0].thumbnail;
            } catch (err) {
                return await sock.sendMessage(chatId, { text: '❌ Failed to search YouTube.' }, { quoted: message });
            }
        }

        // Send Thumbnail Alert
        if (videoThumbnail) {
            try {
                await sock.sendMessage(chatId, {
                    image: { url: videoThumbnail },
                    caption: `🎥 *${videoTitle || 'YouTube Video'}*\n\n⏳ Downloading video, please wait...`
                }, { quoted: message });
            } catch (e) {}
        }

        let downloadUrl = null;
        let fetchedTitle = videoTitle;

        // Server 1: DavidCyril YTmp4 Engine
        try {
            const res1 = await axios.get(`https://api.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(videoUrl)}`, AXIOS_DEFAULTS);
            if (res1.data?.success && res1.data?.result?.download_url) {
                downloadUrl = res1.data.result.download_url;
                fetchedTitle = res1.data.result.title || fetchedTitle;
            }
        } catch (e) {}

        // Server 2: Vreden Engine Fallback
        if (!downloadUrl) {
            try {
                const res2 = await axios.get(`https://api.vreden.web.id/api/ytmp4?url=${encodeURIComponent(videoUrl)}`, AXIOS_DEFAULTS);
                if (res2.data?.result?.download?.url) {
                    downloadUrl = res2.data.result.download.url;
                    fetchedTitle = res2.data.result.title || fetchedTitle;
                }
            } catch (e) {}
        }

        // Server 3: BK9 Engine Fallback
        if (!downloadUrl) {
            try {
                const res3 = await axios.get(`https://bk9.fun/download/youtube?url=${encodeURIComponent(videoUrl)}`, AXIOS_DEFAULTS);
                if (res3.data?.status && res3.data?.BK9?.video) {
                    downloadUrl = res3.data.BK9.video;
                    fetchedTitle = res3.data.BK9.title || fetchedTitle;
                }
            } catch (e) {}
        }

        if (!downloadUrl) {
            return await sock.sendMessage(chatId, { text: '❌ All video servers failed to process this video. Try again later.' }, { quoted: message });
        }

        // Send Final MP4 Video
        await sock.sendMessage(chatId, {
            video: { url: downloadUrl },
            mimetype: 'video/mp4',
            caption: `📥 *${fetchedTitle || 'YouTube Video'}*\n\n> ⚡ *Downloaded by XHUNTERBOT*`
        }, { quoted: message });

    } catch (error) {
        console.error('[VIDEO COMMAND ERROR]:', error.message);
        await sock.sendMessage(chatId, { text: '❌ An unexpected error occurred while processing YouTube video.' }, { quoted: message });
    }
}

module.exports = videoCommand;