const axios = require('axios');

async function facebookCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || 
                        message.message?.imageMessage?.caption || 
                        message.message?.videoMessage?.caption || '';

        const args = rawText.trim().split(/\s+/);
        let url = args.slice(1).join(' ').trim();

        if (!url || (!url.includes('facebook.com') && !url.includes('fb.watch'))) {
            return await sock.sendMessage(chatId, { text: "❌ Please provide a valid Facebook video/reel URL." }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // Step 1: Clean parameters and expand share links
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

        cleanUrl = cleanUrl.split('?')[0];

        let videoUrl = null;

        // Engine 1: Delirius Facebook Downloader
        try {
            const res1 = await axios.get(`https://deliriussapi-official.vercel.app/download/facebook?url=${encodeURIComponent(cleanUrl)}`, { timeout: 12000 });
            if (res1.data?.status && res1.data?.urls) {
                videoUrl = res1.data.urls.find(u => u.sd || u.hd)?.sd || res1.data.urls[0]?.sd || res1.data.urls[0]?.hd;
            }
        } catch (e) {}

        // Engine 2: BK9 Downloader Engine
        if (!videoUrl) {
            try {
                const res2 = await axios.get(`https://bk9.fun/download/fb?url=${encodeURIComponent(cleanUrl)}`, { timeout: 12000 });
                if (res2.data?.status && res2.data?.BK9) {
                    videoUrl = res2.data.BK9.hd || res2.data.BK9.sd || res2.data.BK9;
                }
            } catch (e) {}
        }

        // Engine 3: Vreden FB Engine
        if (!videoUrl) {
            try {
                const res3 = await axios.get(`https://api.vreden.web.id/api/fbdl?url=${encodeURIComponent(cleanUrl)}`, { timeout: 12000 });
                if (res3.data?.result) {
                    videoUrl = res3.data.result.hd || res3.data.result.sd || res3.data.result.url;
                }
            } catch (e) {}
        }

        if (!videoUrl) {
            return await sock.sendMessage(chatId, { text: "❌ Facebook video extract nahi ho saki. Make sure post public ho." }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            video: { url: videoUrl },
            mimetype: 'video/mp4',
            caption: '📥 *Facebook Video Downloaded via XHUNTERBOT*'
        }, { quoted: message });

    } catch (err) {
        console.error('FB Command Error:', err.message);
        await sock.sendMessage(chatId, { text: "❌ Facebook video process karne mein masla hua." }, { quoted: message });
    }
}

module.exports = facebookCommand;