const axios = require('axios');

/**
 * TikTok Downloader (No Watermark)
 */
async function tiktokDownloadCommand(sock, chatId, tiktokUrl, message) {
    try {
        await sock.sendMessage(chatId, { text: '⏳ *Fetching TikTok Video...*' }, { quoted: message });

        let res = await axios.get(`https://api.davidcyriltech.my.id/download/tiktok?url=${encodeURIComponent(tiktokUrl)}`);

        if (res.data && res.data.success && res.data.result) {
            const data = res.data.result;
            await sock.sendMessage(chatId, {
                video: { url: data.play || data.hdplay },
                caption: `🎵 *TikTok Video:* ${data.title || ''}\n\n*Powered by XHUNTERBOT*`
            }, { quoted: message });
            return;
        }

        // Fallback
        let bkRes = await axios.get(`https://bk9.fun/download/tiktok?url=${encodeURIComponent(tiktokUrl)}`);
        if (bkRes.data && bkRes.data.status && bkRes.data.BK9) {
            await sock.sendMessage(chatId, {
                video: { url: bkRes.data.BK9.BK9 },
                caption: `🎵 *TikTok Video Downloaded*\n\n*Powered by XHUNTERBOT*`
            }, { quoted: message });
            return;
        }

        throw new Error('TikTok API error');

    } catch (error) {
        console.error('TikTok Downloader Error:', error.message);
        await sock.sendMessage(chatId, { text: '❌ TikTok video fetch karne me nakami hui.' }, { quoted: message });
    }
}

module.exports = { tiktokDownloadCommand };