const axios = require('axios');

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
        await sock.sendMessage(chatId, { text: '🎵 *Searching & downloading Spotify track...*' }, { quoted: message });

        // Step 1: RapidAPI Spotify Search
        const searchOptions = {
            method: 'GET',
            url: 'https://spotify23.p.rapidapi.com/search/',
            params: {
                q: query,
                type: 'tracks',
                offset: '0',
                limit: '1'
            },
            headers: {
                'x-rapidapi-key': '1448ef7463msh769afae00da1a97p10823djsnbcc28cdffff6',
                'x-rapidapi-host': 'spotify23.p.rapidapi.com'
            }
        };

        const response = await axios.request(searchOptions);
        const track = response.data?.tracks?.items?.[0]?.data;

        let songTitle = query;
        let artistName = '';
        let coverImg = '';

        if (track) {
            songTitle = track.name || query;
            artistName = track.artists?.items?.[0]?.profile?.name || '';
            coverImg = track.albumOfTrack?.coverArt?.sources?.[0]?.url || '';
        }

        // Step 2: Fetch Audio Stream/MP3 for Spotify Track
        const dlUrl = `https://okatsu-rolezapiiz.vercel.app/search/spotify?q=${encodeURIComponent(songTitle + ' ' + artistName)}`;
        const { data: dlData } = await axios.get(dlUrl, { timeout: 20000, headers: { 'user-agent': 'Mozilla/5.0' } });

        const audioUrl = dlData?.result?.audio;

        if (!audioUrl) {
            throw new Error('Could not retrieve downloadable audio link');
        }

        const caption = `🎧 *Title:* ${songTitle}\n👤 *Artist:* ${artistName || 'Unknown'}\n🟢 *Source:* Spotify`.trim();

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
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch Spotify song. Please try another song.' }, { quoted: message });
    }
}

module.exports = spotifyCommand;