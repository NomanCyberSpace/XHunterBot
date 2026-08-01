const axios = require('axios');
const { igdl } = require("ruhend-scraper");

async function instagramCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const url = text.split(/\s+/).slice(1).join(' ').trim();

        if (!url || (!url.includes('instagram.com') && !url.includes('instagr.am'))) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a valid Instagram post/reel link."
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        let mediaUrls = [];

        // Step 1: RapidAPI Social Media Video Downloader
        try {
            const options = {
                method: 'GET',
                url: 'https://social-media-video-downloader.p.rapidapi.com/instagram/post/details',
                params: { url: url },
                headers: {
                    'x-rapidapi-key': '1448ef7463msh769afae00da1a97p10823djsnbcc28cdffff6',
                    'x-rapidapi-host': 'social-media-video-downloader.p.rapidapi.com'
                }
            };
            const res = await axios.request(options);
            if (res.data?.links && Array.isArray(res.data.links)) {
                mediaUrls = res.data.links.map(item => item.link || item.url).filter(Boolean);
            } else if (res.data?.url) {
                mediaUrls.push(res.data.url);
            }
        } catch (e) {
            console.log("RapidAPI Instagram failed, trying fallback scraper...");
        }

        // Step 2: Fallback Scraper (ruhend-scraper)
        if (mediaUrls.length === 0) {
            try {
                const downloadData = await igdl(url);
                if (downloadData?.data) {
                    mediaUrls = downloadData.data.map(m => m.url).filter(Boolean);
                }
            } catch (e2) {}
        }

        if (mediaUrls.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: "❌ No media found. Post might be private or link is invalid."
            }, { quoted: message });
        }

        // Send Media Items
        for (let mediaUrl of mediaUrls.slice(0, 5)) {
            const isVideo = /\.(mp4|mov|avi|mkv)/i.test(mediaUrl) || url.includes('/reel/') || url.includes('/tv/');
            if (isVideo) {
                await sock.sendMessage(chatId, {
                    video: { url: mediaUrl },
                    mimetype: "video/mp4",
                    caption: "𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗫𝗛𝗨𝗡𝗧𝗘𝗥𝗕𝗢𝗧"
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, {
                    image: { url: mediaUrl },
                    caption: "𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗫HUN𝗧𝗘𝗥𝗕𝗢𝗧"
                }, { quoted: message });
            }
        }

    } catch (error) {
        console.error('Error in Instagram command:', error.message);
        await sock.sendMessage(chatId, { text: "❌ An error occurred processing Instagram request." }, { quoted: message });
    }
}

module.exports = instagramCommand;