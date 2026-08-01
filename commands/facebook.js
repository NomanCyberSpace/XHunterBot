const axios = require('axios');

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const url = text.split(/\s+/).slice(1).join(' ').trim();

        if (!url || !url.includes('facebook.com')) {
            return await sock.sendMessage(chatId, { text: "❌ Please provide a Facebook video URL." }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // Primary API
        let videoUrl = null;
        try {
            const res = await axios.get(`https://api.davidcyriltech.my.id/download/facebook?url=${encodeURIComponent(url)}`);
            if (res.data?.success && res.data?.result) {
                videoUrl = res.data.result.hd || res.data.result.sd;
            }
        } catch (e) {}

        // Backup RapidAPI
        if (!videoUrl) {
            try {
                const res = await axios.get('https://social-media-video-downloader.p.rapidapi.com/facebook/video/details', {
                    params: { url },
                    headers: {
                        'x-rapidapi-key': '1448ef7463msh769afae00da1a97p10823djsnbcc28cdffff6',
                        'x-rapidapi-host': 'social-media-video-downloader.p.rapidapi.com'
                    }
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
        await sock.sendMessage(chatId, { text: "❌ Failed to download Facebook video." }, { quoted: message });
    }
}

module.exports = facebookCommand;