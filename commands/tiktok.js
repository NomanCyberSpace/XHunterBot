const axios = require('axios');

async function tiktokDownloadCommand(sock, chatId, tiktokUrl, message) {
    try {
        if (!tiktokUrl) {
            return await sock.sendMessage(chatId, { text: '❌ Please provide a TikTok video link.' }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        let videoUrl = null;
        let title = "TikTok Video";

        // Unpack shortened link (vt.tiktok.com)
        let cleanUrl = tiktokUrl;
        try {
            const redirectCheck = await axios.get(tiktokUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                maxRedirects: 5,
                timeout: 8000
            });
            if (redirectCheck.request?.res?.responseUrl) {
                cleanUrl = redirectCheck.request.res.responseUrl;
            }
        } catch (e) {}

        // Server 1: TikWM (Most Reliable Free TikTok API)
        try {
            const res = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({ url: cleanUrl }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                timeout: 10000
            });
            if (res.data?.data?.play) {
                videoUrl = res.data.data.play;
                title = res.data.data.title || title;
            }
        } catch (e) {
            console.log("TikWM API failed");
        }

        // Server 2: BK9 Fallback
        if (!videoUrl) {
            try {
                const bkRes = await axios.get(`https://bk9.fun/download/tiktok?url=${encodeURIComponent(cleanUrl)}`, { timeout: 10000 });
                if (bkRes.data?.status && bkRes.data?.BK9?.BK9) {
                    videoUrl = bkRes.data.BK9.BK9;
                }
            } catch (e) {}
        }

        // Server 3: RapidAPI Social Media Video Downloader
        if (!videoUrl) {
            try {
                const options = {
                    method: 'GET',
                    url: 'https://social-media-video-downloader.p.rapidapi.com/tiktok/video/details',
                    params: { url: cleanUrl },
                    headers: {
                        'x-rapidapi-key': '1448ef7463msh769afae00da1a97p10823djsnbcc28cdffff6',
                        'x-rapidapi-host': 'social-media-video-downloader.p.rapidapi.com'
                    },
                    timeout: 10000
                };
                const res = await axios.request(options);
                videoUrl = res.data?.play || res.data?.video || res.data?.url;
            } catch (e) {}
        }

        if (!videoUrl) throw new Error("All TikTok downloader servers failed");

        await sock.sendMessage(chatId, {
            video: { url: videoUrl },
            caption: `🎵 *${title}*\n\n*Downloaded via XHUNTERBOT*`
        }, { quoted: message });

    } catch (error) {
        console.error('TikTok Error:', error.message);
        await sock.sendMessage(chatId, { text: '❌ TikTok video fetch nahi ho saki. Direct video link try karein.' }, { quoted: message });
    }
}

module.exports = { tiktokDownloadCommand };