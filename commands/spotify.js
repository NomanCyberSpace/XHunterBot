const axios = require('axios');
const yts = require('yt-search');

const RAPID_HEADERS = {
    'x-rapidapi-key': '1448ef7463msh769afae00da1a97p10823djsnbcc28cdffff6',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

async function spotifyCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';

        const used = (rawText || '').split(/\s+/)[0] || '.spotify';
        const query = rawText.slice(used.length).trim();

        if (!query) {
            await sock.sendMessage(chatId, { text: '❌ *Usage:* `.song <song name>`\n*Example:* `.song pal pal`' }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { react: { text: '🎵', key: message.key } });
        await sock.sendMessage(chatId, { text: '🎵 *Searching & fetching audio...*' }, { quoted: message });

        let songTitle = query;
        let artistName = '';
        let coverImg = '';

        // Step 1: Spotify Metadata Search (Track name + Artist + Album cover)
        try {
            const spotifyRes = await axios.get('https://spotify23.p.rapidapi.com/search/', {
                params: { q: query, type: 'tracks', offset: '0', limit: '1' },
                headers: {
                    ...RAPID_HEADERS,
                    'x-rapidapi-host': 'spotify23.p.rapidapi.com'
                },
                timeout: 8000
            });
            const track = spotifyRes.data?.tracks?.items?.[0]?.data;
            if (track) {
                songTitle = track.name || query;
                artistName = track.artists?.items?.[0]?.profile?.name || '';
                coverImg = track.albumOfTrack?.coverArt?.sources?.[0]?.url || '';
            }
        } catch (e) {
            console.log('Spotify Search failed/skipped, falling back to raw query.');
        }

        // Step 2: YouTube Search (Fallback / Exact Match)
        const searchYt = await yts(`${songTitle} ${artistName}`.trim());
        if (!searchYt?.videos?.length) {
            throw new Error('No track found on YouTube or Spotify');
        }

        const ytVideo = searchYt.videos[0];
        const ytUrl = ytVideo.url;
        const videoId = ytVideo.videoId;
        if (!coverImg) coverImg = ytVideo.thumbnail;

        let audioUrl = null;

        // API 1: Yupra API (Valid Direct MP3 Stream)
        try {
            const res1 = await axios.get(`https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(ytUrl)}`, { timeout: 12000 });
            if (res1.data?.success && res1.data?.data?.download_url) {
                audioUrl = res1.data.data.download_url;
            }
        } catch (e) {}

        // API 2: RapidAPI YT MP3 Downloader
        if (!audioUrl) {
            try {
                const res2 = await axios.get('https://yt-search-and-download-mp3.p.rapidapi.com/mp3', {
                    params: { id: videoId, url: ytUrl },
                    headers: {
                        ...RAPID_HEADERS,
                        'x-rapidapi-host': 'yt-search-and-download-mp3.p.rapidapi.com'
                    },
                    timeout: 15000
                });
                audioUrl = res2.data?.link || res2.data?.downloadUrl || res2.data?.url;
            } catch (e) {}
        }

        // API 3: EliteProTech Fallback
        if (!audioUrl) {
            try {
                const res3 = await axios.get(`https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(ytUrl)}&format=mp3`, { timeout: 12000 });
                if (res3.data?.success && res3.data?.downloadURL) {
                    audioUrl = res3.data.downloadURL;
                }
            } catch (e) {}
        }

        if (!audioUrl) {
            throw new Error('All audio download sources failed');
        }

        const caption = `🎧 *Title:* ${songTitle}\n👤 *Artist:* ${artistName || ytVideo.author?.name || 'Unknown'}\n⏱️ *Duration:* ${ytVideo.timestamp || 'N/A'}\n🟢 *Status:* Downloaded`.trim();

        // Send Album Cover / Thumbnail
        if (coverImg) {
            await sock.sendMessage(chatId, { image: { url: coverImg }, caption }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: caption }, { quoted: message });
        }

        // Send Clean Audio Stream (Fixes 'Invalid Audio' issue)
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mp4',
            ptt: false,
            fileName: `${songTitle.replace(/[\\/:*?"<>|]/g, '')}.mp3`
        }, { quoted: message });

    } catch (error) {
        console.error('[SPOTIFY/SONG ERROR]:', error?.message || error);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch audio. Please try another song title.' }, { quoted: message });
    }
}

module.exports = spotifyCommand;