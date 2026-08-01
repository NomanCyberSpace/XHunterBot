const axios = require('axios');

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        let url = text.split(/\s+/).slice(1).join(' ').trim();

        if (!url || !url.includes('facebook.com')) {
            return await sock.sendMessage(chatId, { text: "❌ Please provide a valid Facebook video link." }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // Resolve redirect share links (e.g. facebook.com/share/r/...)
        try {
            const headRes = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                maxRedirects: 5,
                timeout: 10000
            });
            if (headRes.request?.res?.responseUrl) {
                url = headRes.request.res.responseUrl;
            }
        } catch (e) {}

        let videoUrl = null;

        // API 1: DavidCyril API
        try {
            const res = await axios.get(`https://api.davidcyriltech.my.id/download/facebook?url=${encodeURIComponent(url)}`, { timeout: 15000 });
            if (res.data?.success && res.data?.result) {
                videoUrl = res.data.result.hd || res.data.result.sd || res.data.result.video;
            }
        } catch (e) {}

        // API 2: RapidAPI Social Media Video Downloader
        if (!videoUrl) {
            try {
                const res = await axios.get('https://social-media-video-downloader.p.rapidapi.com/facebook/video/details', {
                    params: { url },
                    headers: {
                        'x-rapidapi-key': '1448ef7463msh769afae00da1a97p10823djsnbcc28cdffff6',
                        'x-rapidapi-host': 'social-media-video-downloader.p.rapidapi.com'
                    },
                    timeout: 15000
                });
                videoUrl = res.data?.hd_url || res.data?.sd_url;
            } catch (e) {}
        }

        if (!videoUrl) throw new Error("Could not extract Facebook video link");

        await sock.sendMessage(chatId, {
            video: { url: videoUrl },
            mimetype: 'video/mp4',
            caption: '📥 *Facebook Video Downloaded*'
        }, { quoted: message });

    } catch (err) {
        console.error('FB Error:', err.message);
        await sock.sendMessage(chatId, { text: "❌ Failed to download Facebook video. Ensure the video is public." }, { quoted: message });
    }
}

module.exports = facebookCommand;