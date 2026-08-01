const axios = require('axios');

async function tiktokDownloadCommand(sock, chatId, tiktokUrl, message) {
    try {
        if (!tiktokUrl) {
            return await sock.sendMessage(chatId, { text: '❌ Please provide a TikTok video link.' }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        let videoUrl = null;
        let title = "TikTok Video";

        // Resolve shortened links like vt.tiktok.com
        let resolvedUrl = tiktokUrl;
        try {
            const headRes = await axios.get(tiktokUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                maxRedirects: 5,
                timeout: 10000
            });
            if (headRes.request?.res?.responseUrl) {
                resolvedUrl = headRes.request.res.responseUrl;
            }
        } catch (e) {}

        // API 1: DavidCyril API
        try {
            const res = await axios.get(`https://api.davidcyriltech.my.id/download/tiktok?url=${encodeURIComponent(resolvedUrl)}`, { timeout: 15000 });
            if (res.data?.success && res.data?.result) {
                videoUrl = res.data.result.play || res.data.result.hdplay;
                title = res.data.result.title || title;
            }
        } catch (e) {}

        // API 2: BK9 API
        if (!videoUrl) {
            try {
                const bkRes = await axios.get(`https://bk9.fun/download/tiktok?url=${encodeURIComponent(resolvedUrl)}`, { timeout: 15000 });
                if (bkRes.data?.status && bkRes.data?.BK9?.BK9) {
                    videoUrl = bkRes.data.BK9.BK9;
                }
            } catch (e) {}
        }

        if (!videoUrl) throw new Error("TikTok download failed");

        await sock.sendMessage(chatId, {
            video: { url: videoUrl },
            caption: `🎵 *${title}*\n\n*Downloaded via XHUNTERBOT*`
        }, { quoted: message });

    } catch (error) {
        console.error('TikTok Error:', error.message);
        await sock.sendMessage(chatId, { text: '❌ TikTok video download karne mein masla hua.' }, { quoted: message });
    }
}

module.exports = { tiktokDownloadCommand };