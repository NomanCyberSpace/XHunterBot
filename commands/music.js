const axios = require('axios');

/**
 * 1. Play / Song Command (YouTube Audio Search & Download)
 * Usage: .play <song name>  OR  .song <song name / link>
 */
async function playCommand(sock, chatId, query, message) {
    if (!query) {
        await sock.sendMessage(chatId, { text: '⚠️ *Usage:* `.play <song name>` or `.song <song name/url>`' }, { quoted: message });
        return;
    }

    try {
        await sock.sendMessage(chatId, { text: `🎵 *Searching and downloading:* "${query}"...` }, { quoted: message });

        // Primary API: DavidCyril API
        let searchApi = `https://api.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(query)}`;
        let response = await axios.get(searchApi);

        if (response.data && response.data.success && response.data.result) {
            const songData = response.data.result;

            await sock.sendMessage(chatId, {
                audio: { url: songData.download_url },
                mimetype: 'audio/mp4',
                fileName: `${songData.title || 'song'}.mp3`,
                caption: `🎶 *Title:* ${songData.title || query}\n\n*Powered by XHUNTERBOT*`
            }, { quoted: message });
            return;
        }

        // Fallback API: BK9 API
        let fallbackApi = `https://bk9.fun/download/youtube?url=${encodeURIComponent(query)}`;
        let fallbackRes = await axios.get(fallbackApi);

        if (fallbackRes.data && fallbackRes.data.status && fallbackRes.data.BK9) {
            const fbData = fallbackRes.data.BK9;

            await sock.sendMessage(chatId, {
                audio: { url: fbData.audio },
                mimetype: 'audio/mp4',
                fileName: `${fbData.title || 'song'}.mp3`,
                caption: `🎶 *Title:* ${fbData.title}\n\n*Powered by XHUNTERBOT*`
            }, { quoted: message });
            return;
        }

        throw new Error('All APIs failed to fetch audio');

    } catch (error) {
        console.error('Play/Song Command Error:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Audio download nahi ho saka. Naya song name ya direct link try karen.' }, { quoted: message });
    }
}

/**
 * 2. Spotify Downloader Command
 * Usage: .spotify <spotify track link / query>
 */
async function spotifyCommand(sock, chatId, query, message) {
    if (!query) {
        await sock.sendMessage(chatId, { text: '⚠️ *Usage:* `.spotify <song name or spotify link>`' }, { quoted: message });
        return;
    }

    try {
        await sock.sendMessage(chatId, { text: '🟢 *Fetching track from Spotify...*' }, { quoted: message });

        // Primary API for Spotify Downloader
        let res = await axios.get(`https://api.davidcyriltech.my.id/download/spotify?url=${encodeURIComponent(query)}`);

        if (res.data && res.data.success && res.data.result) {
            const data = res.data.result;

            await sock.sendMessage(chatId, {
                audio: { url: data.download_url || data.link },
                mimetype: 'audio/mp4',
                fileName: `${data.title || 'spotify_track'}.mp3`,
                caption: `🎧 *Track:* ${data.title || 'Spotify Song'}\n👤 *Artist:* ${data.artist || 'Unknown'}\n\n*Powered by XHUNTERBOT*`
            }, { quoted: message });
            return;
        }

        // Fallback API for Spotify
        let bkRes = await axios.get(`https://bk9.fun/download/spotify?url=${encodeURIComponent(query)}`);

        if (bkRes.data && bkRes.data.status && bkRes.data.BK9) {
            const bkData = bkRes.data.BK9;

            await sock.sendMessage(chatId, {
                audio: { url: bkData.download || bkData.url },
                mimetype: 'audio/mp4',
                fileName: `${bkData.title || 'spotify_track'}.mp3`,
                caption: `🎧 *Track:* ${bkData.title || 'Spotify Song'}\n\n*Powered by XHUNTERBOT*`
            }, { quoted: message });
            return;
        }

        throw new Error('Spotify API failed');

    } catch (error) {
        console.error('Spotify Command Error:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Spotify track download nahi ho saka. Spotify link ya valid song name try karen.' }, { quoted: message });
    }
}

module.exports = { playCommand, spotifyCommand };