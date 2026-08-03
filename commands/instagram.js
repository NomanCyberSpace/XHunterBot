const axios = require('axios');

async function instagramCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || 
                        message.message?.imageMessage?.caption || 
                        message.message?.videoMessage?.caption || '';

        const args = rawText.trim().split(/\s+/);
        let url = args.slice(1).join(' ').trim();

        if (!url || (!url.includes('instagram.com') && !url.includes('instagr.am'))) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Please provide a valid Instagram post/reel link."
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        // Strip tracking parameters (?igsh=...)
        let cleanUrl = url.split('?')[0];

        let mediaUrls = [];

        // Engine 1: BK9 Downloader Engine
        try {
            const res1 = await axios.get(`https://bk9.fun/download/instagram?url=${encodeURIComponent(cleanUrl)}`, { timeout: 12000 });
            if (res1.data?.status && res1.data?.BK9) {
                const bkData = res1.data.BK9;
                if (Array.isArray(bkData)) {
                    mediaUrls = bkData.map(m => m.url || m).filter(Boolean);
                } else if (typeof bkData === 'string') {
                    mediaUrls.push(bkData);
                } else if (bkData.url) {
                    mediaUrls.push(bkData.url);
                }
            }
        } catch (e) {}

        // Engine 2: Vreden Engine
        if (mediaUrls.length === 0) {
            try {
                const res2 = await axios.get(`https://api.vreden.web.id/api/igdl?url=${encodeURIComponent(cleanUrl)}`, { timeout: 12000 });
                if (res2.data?.result && Array.isArray(res2.data.result)) {
                    mediaUrls = res2.data.result.map(item => item.url || item.downloadUrl || item).filter(Boolean);
                }
            } catch (e) {}
        }

        if (mediaUrls.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: "❌ No media found. Post might be private or link is invalid."
            }, { quoted: message });
        }

        for (let mediaUrl of mediaUrls.slice(0, 5)) {
            const isVideo = /\.(mp4|mov|avi|mkv)/i.test(mediaUrl) || cleanUrl.includes('/reel/') || cleanUrl.includes('/tv/');
            if (isVideo) {
                await sock.sendMessage(chatId, {
                    video: { url: mediaUrl },
                    mimetype: "video/mp4",
                    caption: "𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗫𝗛𝗨𝗡𝗧𝗘𝗥𝗕𝗢𝗧"
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, {
                    image: { url: mediaUrl },
                    caption: "𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗫𝗛𝗨𝗡𝗧𝗘𝗥𝗕𝗢𝗧"
                }, { quoted: message });
            }
        }

    } catch (error) {
        console.error('Instagram Command Error:', error.message);
        await sock.sendMessage(chatId, { text: "❌ An error occurred processing Instagram request." }, { quoted: message });
    }
}

module.exports = instagramCommand;