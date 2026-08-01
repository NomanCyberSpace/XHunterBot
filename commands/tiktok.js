const axios = require('axios');

async function tiktokDownloadCommand(sock, chatId, tiktokUrl, message) {
    try {
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        let videoUrl = null;
        let title = "TikTok Video";

        // Step 1: RapidAPI Social Media Video Downloader
        try {
            const options = {
                method: 'GET',
                url: 'https://social-media-video-downloader.p.rapidapi.com/tiktok/video/details',
                params: { url: tiktokUrl },
                headers: {
                    'x-rapidapi-key': '1448ef7463msh769afae00da1a97p10823djsnbcc28cdffff6',
                    'x-rapidapi-host': 'social-media-video-downloader.p.rapidapi.com'
                }
            };
            const res = await axios.request(options);
            if (res.data?.play || res.data?.video || res.data?.url) {
                videoUrl = res.data.play || res.data.video || res.data.url;
                title = res.data.title || title;
            }
        } catch (e) {
            console.log("RapidAPI TikTok failed, trying fallback...");
        }

        // Step 2: Fallback DavidCyril / BK9 API
        if (!videoUrl) {
            try {
                let res = await axios.get(`https://api.davidcyriltech.my.id/download/tiktok?url=${encodeURIComponent(tiktokUrl)}`);
                if (res.data?.success && res.data?.result?.play) {
                    videoUrl = res.data.result.play;
                    title = res.data.result.title || title;
                }
            } catch (e2) {}
        }

        if (!videoUrl) {
            throw new Error("TikTok download failed");
        }

        await sock.sendMessage(chatId, {
            video: { url: videoUrl },
            caption: `🎵 *TikTok Video:* ${title}\n\n*Powered by XHUNTERBOT*`
        }, { quoted: message });

    } catch (error) {
        console.error('TikTok Downloader Error:', error.message);
        await sock.sendMessage(chatId, { text: '❌ TikTok video fetch karne me nakami hui.' }, { quoted: message });
    }
}

module.exports = { tiktokDownloadCommand };