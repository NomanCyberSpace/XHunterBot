const axios = require('axios');
const yts = require('yt-search');

const RAPID_HEADERS = {
    'x-rapidapi-key': '1448ef7463msh769afae00da1a97p10823djsnbcc28cdffff6',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
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
            await sock.sendMessage(chatId, { text: 'Usage: .song <song name/keywords>\nExample: .song sanson ki mala' }, { quoted: message });
            return;
        }

        // Send Progress message
        await sock.sendMessage(chatId, { text: '🎵 *Searching & downloading audio...*' }, { quoted: message });

        let songTitle = query;
        let artistName = '';
        let coverImg = '';

        // Step 1: Try Spotify Search for Album Cover & Track Info
        try {
            const spotifyRes = await axios.get('https://spotify23.p.rapidapi.com/search/', {
                params: { q: query, type: 'tracks', offset: '0', limit: '1' },
                headers: {
                    ...RAPID_HEADERS,
                    'x-rapidapi-host': 'spotify23.p.rapidapi.com'
                },
                timeout: 10000
            });
            const track = spotifyRes.data?.tracks?.items?.[0]?.data;
            if (track) {
                songTitle = track.name || query;
                artistName = track.artists?.items?.[0]?.profile?.name || '';
                coverImg = track.albumOfTrack?.coverArt?.sources?.[0]?.url || '';
            }
        } catch (e) {
            console.log('Spotify Metadata Search skipped/failed, using raw query');
        }

        let audioUrl = null;

        // Step 2: YouTube Search for exact Video ID / URL
        const searchYt = await yts(`${songTitle} ${artistName}`.trim());
        if (!searchYt?.videos?.length) {
            throw new Error('No audio found for this query');
        }

        const ytVideo = searchYt.videos[0];
        const ytUrl = ytVideo.url;
        const videoId = ytVideo.videoId;
        if (!coverImg) coverImg = ytVideo.thumbnail;

        // Method 1: RapidAPI YT Search & Download MP3 (Screenshot API)
        try {
            const ytRapidRes = await axios.get('https://yt-search-and-download-mp3.p.rapidapi.com/mp3', {
                params: { id: videoId || ytUrl, url: ytUrl },
                headers: {
                    ...RAPID_HEADERS,
                    'x-rapidapi-host': 'yt-search-and-download-mp3.p.rapidapi.com'
                },
                timeout: 20000
            });

            if (ytRapidRes.data?.link || ytRapidRes.data?.downloadUrl || ytRapidRes.data?.url) {
                audioUrl = ytRapidRes.data.link || ytRapidRes.data.downloadUrl || ytRapidRes.data.url;
            }
        } catch (err1) {
            console.log('RapidAPI YT MP3 failed, trying fallback 1...');
        }

        // Method 2: Yupra API Fallback
        if (!audioUrl) {
            try {
                const res2 = await axios.get(`https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(ytUrl)}`, { timeout: 15000 });
                if (res2.data?.success && res2.data?.data?.download_url) {
                    audioUrl = res2.data.data.download_url;
                }
            } catch (err2) {
                console.log('Yupra API failed, trying fallback 2...');
            }
        }

        // Method 3: EliteProTech API Fallback
        if (!audioUrl) {
            try {
                const res3 = await axios.get(`https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(ytUrl)}&format=mp3`, { timeout: 15000 });
                if (res3.data?.success && res3.data?.downloadURL) {
                    audioUrl = res3.data.downloadURL;
                }
            } catch (err3) {
                console.log('EliteProTech API failed');
            }
        }

        if (!audioUrl) {
            throw new Error('All MP3 download sources failed');
        }

        const caption = `🎧 *Title:* ${songTitle}\n👤 *Artist:* ${artistName || ytVideo.author?.name || 'Unknown'}\n⏱️ *Duration:* ${ytVideo.timestamp || 'N/A'}\n🟢 *Status:* Downloaded!`.trim();

        // Send Album Art Image
        if (coverImg) {
            await sock.sendMessage(chatId, { image: { url: coverImg }, caption }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: caption }, { quoted: message });
        }

        // Send Audio MP3
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${songTitle.replace(/[\\/:*?"<>|]/g, '')}.mp3`
        }, { quoted: message });

    } catch (error) {
        console.error('[SONG/SPOTIFY] error:', error?.message || error);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch audio. Please try with another keyword or title.' }, { quoted: message });
    }
}

module.exports = spotifyCommand;