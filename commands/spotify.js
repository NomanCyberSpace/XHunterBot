const axios = require('axios');
const yts = require('yt-search');

const AXIOS_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*'
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
            await sock.sendMessage(chatId, { text: 'Usage: .spotify <song/artist/keywords>\nExample: .spotify pal pal' }, { quoted: message });
            return;
        }

        // Wait message
        await sock.sendMessage(chatId, { text: '🎵 *Searching & downloading track...*' }, { quoted: message });

        let songTitle = query;
        let artistName = '';
        let coverImg = '';

        // Step 1: RapidAPI Spotify Search for Metadata
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
            console.log('RapidAPI Spotify Search failed, using raw query');
        }

        // Step 2: YouTube Search for matching audio
        const searchYt = await yts(`${songTitle} ${artistName}`);
        if (!searchYt?.videos?.length) {
            throw new Error('No audio found for this song');
        }
        
        const ytVideo = searchYt.videos[0];
        const ytUrl = ytVideo.url;
        if (!coverImg) coverImg = ytVideo.thumbnail;

        let audioUrl = null;

        // API Method 1: Yupra API
        try {
            const res = await axios.get(`https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(ytUrl)}`, { headers: AXIOS_HEADERS, timeout: 15000 });
            if (res.data?.success && res.data?.data?.download_url) {
                audioUrl = res.data.data.download_url;
            }
        } catch (e) {
            console.log('API 1 (Yupra) failed');
        }

        // API Method 2: EliteProTech API
        if (!audioUrl) {
            try {
                const res = await axios.get(`https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(ytUrl)}&format=mp3`, { headers: AXIOS_HEADERS, timeout: 15000 });
                if (res.data?.success && res.data?.downloadURL) {
                    audioUrl = res.data.downloadURL;
                }
            } catch (e) {
                console.log('API 2 (EliteProTech) failed');
            }
        }

        // API Method 3: Keith API
        if (!audioUrl) {
            try {
                const res = await axios.get(`https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(ytUrl)}`, { headers: AXIOS_HEADERS, timeout: 15000 });
                if (res.data?.status && res.data?.result?.downloadUrl) {
                    audioUrl = res.data.result.downloadUrl;
                }
            } catch (e) {
                console.log('API 3 (Keith) failed');
            }
        }

        // API Method 4: Okatsu Spotify Direct
        if (!audioUrl) {
            try {
                const res = await axios.get(`https://okatsu-rolezapiiz.vercel.app/search/spotify?q=${encodeURIComponent(songTitle + ' ' + artistName)}`, { headers: AXIOS_HEADERS, timeout: 15000 });
                if (res.data?.result?.audio) {
                    audioUrl = res.data.result.audio;
                }
            } catch (e) {
                console.log('API 4 (Okatsu) failed');
            }
        }

        if (!audioUrl) {
            throw new Error('All 4 downloader APIs failed');
        }

        const caption = `🎧 *Title:* ${songTitle}\n👤 *Artist:* ${artistName || 'Unknown'}\n🟢 *Status:* Downloaded Successfully!`.trim();

        // Send Cover Art
        if (coverImg) {
            await sock.sendMessage(chatId, { image: { url: coverImg }, caption }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: caption }, { quoted: message });
        }

        // Send MP3 Audio File
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${songTitle.replace(/[\\/:*?"<>|]/g, '')}.mp3`
        }, { quoted: message });

    } catch (error) {
        console.error('[SPOTIFY] error:', error?.message || error);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch song. Download sources down, please try another query.' }, { quoted: message });
    }
}

module.exports = spotifyCommand;