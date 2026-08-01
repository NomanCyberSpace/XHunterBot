const axios = require('axios');
const yts = require('yt-search');

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
            await sock.sendMessage(chatId, { text: 'Usage: .spotify <song/artist/keywords>\nExample: .spotify con calma' }, { quoted: message });
            return;
        }

        // Wait message
        await sock.sendMessage(chatId, { text: '🎵 *Searching & downloading track...*' }, { quoted: message });

        let songTitle = query;
        let artistName = '';
        let coverImg = '';

        // Step 1: Search track details on Spotify via RapidAPI
        try {
            const searchOptions = {
                method: 'GET',
                url: 'https://spotify23.p.rapidapi.com/search/',
                params: { q: query, type: 'tracks', offset: '0', limit: '1' },
                headers: {
                    'x-rapidapi-key': '1448ef7463msh769afae00da1a97p10823djsnbcc28cdffff6',
                    'x-rapidapi-host': 'spotify23.p.rapidapi.com'
                }
            };
            const response = await axios.request(searchOptions);
            const track = response.data?.tracks?.items?.[0]?.data;

            if (track) {
                songTitle = track.name || query;
                artistName = track.artists?.items?.[0]?.profile?.name || '';
                coverImg = track.albumOfTrack?.coverArt?.sources?.[0]?.url || '';
            }
        } catch (e) {
            console.log('Spotify RapidAPI search failed, falling back to query');
        }

        // Step 2: Audio Download Fallback System
        let audioUrl = null;

        // Try API 1 (Keith API)
        try {
            const searchYt = await yts(`${songTitle} ${artistName}`);
            if (searchYt?.videos?.length > 0) {
                const ytUrl = searchYt.videos[0].url;
                if (!coverImg) coverImg = searchYt.videos[0].thumbnail;

                const res1 = await axios.get(`https://apis-keith.vercel.app/download/dlmp3?url=${ytUrl}`, { timeout: 15000 });
                if (res1.data?.status && res1.data?.result?.downloadUrl) {
                    audioUrl = res1.data.result.downloadUrl;
                }
            }
        } catch (err1) {
            console.log('API 1 download failed, trying API 2...');
        }

        // Try API 2 (Okatsu Spotify API) if API 1 failed
        if (!audioUrl) {
            try {
                const dlUrl = `https://okatsu-rolezapiiz.vercel.app/search/spotify?q=${encodeURIComponent(songTitle + ' ' + artistName)}`;
                const { data: dlData } = await axios.get(dlUrl, { timeout: 15000, headers: { 'user-agent': 'Mozilla/5.0' } });
                if (dlData?.result?.audio) {
                    audioUrl = dlData.result.audio;
                }
            } catch (err2) {
                console.log('API 2 download failed');
            }
        }

        if (!audioUrl) {
            throw new Error('All audio download sources failed');
        }

        const caption = `🎧 *Title:* ${songTitle}\n👤 *Artist:* ${artistName || 'Unknown'}\n🟢 *Status:* Downloaded`.trim();

        // Send Album Cover / Thumbnail
        if (coverImg) {
            await sock.sendMessage(chatId, { image: { url: coverImg }, caption }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: caption }, { quoted: message });
        }

        // Send MP3 Audio
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${songTitle.replace(/[\\/:*?"<>|]/g, '')}.mp3`
        }, { quoted: message });

    } catch (error) {
        console.error('[SPOTIFY] error:', error?.message || error);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch song. Please try again with another keyword.' }, { quoted: message });
    }
}

module.exports = spotifyCommand;