const axios = require('axios');

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        let url = text.split(/\s+/).slice(1).join(' ').trim();

        if (!url || !url.includes('facebook.com')) {
            return await sock.sendMessage(chatId, { text: "❌ Please provide a valid Facebook video link." }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // Unpack share links (facebook.com/share/r/...)
        let cleanUrl = url;
        try {
            const headRes = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                maxRedirects: 10,
                timeout: 8000
            });
            if (headRes.request?.res?.responseUrl) {
                cleanUrl = headRes.request.res.responseUrl;
            }
        } catch (e) {}

        let videoUrl = null;

        // Server 1: SnapSave/FB Downloader Engine
        try {
            const res = await axios.get(`https://api.vreden.web.id/api/fbdl?url=${encodeURIComponent(cleanUrl)}`, { timeout: 12000 });
            if (res.data?.result) {
                videoUrl = res.data.result.hd || res.data.result.sd || res.data.result.url;
            }
        } catch (e) {}

        // Server 2: DavidCyril API
        if (!videoUrl) {
            try {
                const res = await axios.get(`https://api.davidcyriltech.my.id/download/facebook?url=${encodeURIComponent(cleanUrl)}`, { timeout: 12000 });
                if (res.data?.success && res.data?.result) {
                    videoUrl = res.data.result.hd || res.data.result.sd || res.data.result.video;
                }
            } catch (e) {}
        }

        // Server 3: RapidAPI
        if (!videoUrl) {
            try {
                const res = await axios.get('https://social-media-video-downloader.p.rapidapi.com/facebook/video/details', {
                    params: { url: cleanUrl },
                    headers: {
                        'x-rapidapi-key': '1448ef7463msh769afae00da1a97p10823djsnbcc28cdffff6',
                        'x-rapidapi-host': 'social-media-video-downloader.p.rapidapi.com'
                    },
                    timeout: 12000
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
        await sock.sendMessage(chatId, { text: "❌ Failed to download Facebook video. Ensure link is public." }, { quoted: message });
    }
}

module.exports = facebookCommand;