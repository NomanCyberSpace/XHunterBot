const axios = require('axios');

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const url = text.split(/\s+/).slice(1).join(' ').trim();
        
        if (!url || !url.includes('facebook.com')) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a valid Facebook video URL.\nExample: .fb https://www.facebook.com/..."
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        let videoUrl = null;
        let title = "Facebook Video";

        // Step 1: RapidAPI Social Media Video Downloader
        try {
            const options = {
                method: 'GET',
                url: 'https://social-media-video-downloader.p.rapidapi.com/facebook/video/details',
                params: { url: url },
                headers: {
                    'x-rapidapi-key': '1448ef7463msh769afae00da1a97p10823djsnbcc28cdffff6',
                    'x-rapidapi-host': 'social-media-video-downloader.p.rapidapi.com'
                }
            };
            const res = await axios.request(options);
            if (res.data?.hd_url || res.data?.sd_url) {
                videoUrl = res.data.hd_url || res.data.sd_url;
                title = res.data.title || title;
            }
        } catch (err) {
            console.log("RapidAPI FB failed, trying fallback...");
        }

        // Step 2: Fallback Hanggts API
        if (!videoUrl) {
            try {
                const fbApiUrl = `https://api.hanggts.xyz/download/facebook?url=${encodeURIComponent(url)}`;
                const res = await axios.get(fbApiUrl, { timeout: 15000 });
                if (res.data?.result?.media) {
                    videoUrl = res.data.result.media.video_hd || res.data.result.media.video_sd;
                }
            } catch (err2) {
                console.log("Fallback FB API failed");
            }
        }

        if (!videoUrl) {
            throw new Error("Unable to fetch Facebook video");
        }

        await sock.sendMessage(chatId, {
            video: { url: videoUrl },
            mimetype: "video/mp4",
            caption: `📥 *Downloaded via XHUNTERBOT*\n📝 Title: ${title}`
        }, { quoted: message });

    } catch (error) {
        console.error('Error in Facebook command:', error.message);
        await sock.sendMessage(chatId, { text: "❌ Failed to download Facebook video. Please check if link is public." }, { quoted: message });
    }
}

module.exports = facebookCommand;