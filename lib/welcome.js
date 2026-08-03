const { handleWelcome } = require('../lib/welcome');
const { isWelcomeOn, getWelcome } = require('../lib/index');
const { channelInfo } = require('../lib/messageConfig');
const fetch = require('node-fetch');

async function welcomeCommand(sock, chatId, message, match) {
    // Check if it's a group
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' });
        return;
    }

    // Extract match from message
    const text = message.message?.conversation || 
                message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');

    await handleWelcome(sock, chatId, message, matchText);
}

async function handleJoinEvent(sock, id, participants) {
    // Check if welcome is enabled for this group
    const isWelcomeEnabled = await isWelcomeOn(id);
    if (!isWelcomeEnabled) return;

    // Get custom welcome message
    const customMessage = await getWelcome(id);

    // Get group metadata
    const groupMetadata = await sock.groupMetadata(id);
    const groupName = groupMetadata.subject;
    const groupDesc = groupMetadata.desc || 'No description available';

    // Send welcome message for each new participant
    for (const participant of participants) {
        try {
            // Handle case where participant might be an object or not a string
            const participantString = typeof participant === 'string' ? participant : (participant.id || participant.toString());
            const userNum = participantString.split('@')[0];
            
            // Get user's display name
            let displayName = userNum;
            try {
                const groupParticipants = groupMetadata.participants;
                const userParticipant = groupParticipants.find(p => p.id === participantString);
                if (userParticipant && userParticipant.name) {
                    displayName = userParticipant.name;
                }
            } catch (nameError) {
                console.log('Could not fetch display name, using phone number');
            }
            
            // Process custom message or default message
            let finalMessage;
            if (customMessage) {
                finalMessage = customMessage
                    .replace(/{user}/g, `@${userNum}`)
                    .replace(/{group}/g, groupName)
                    .replace(/{description}/g, groupDesc);
            } else {
                const now = new Date();
                const timeString = now.toLocaleString('en-US', {
                    month: '2-digit',
                    day: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
                
                finalMessage = `╭╼━≪•𝙽𝙴𝚆 𝙼𝙴𝙼𝙱𝙴𝚁•≫━╾╮\n` +
                               `┃ 𝚆𝙴𝙻𝙲𝙾𝙼𝙴: @${userNum} 👋\n` +
                               `┃ 𝙼𝙴𝙼𝙱𝙴𝚁𝚂: #${groupMetadata.participants.length}\n` +
                               `┃ 𝚃𝙸𝙼𝙴: ${timeString}\n` +
                               `╰━━━━━━━━━━━━━━━╯\n\n` +
                               `Hey @${userNum}, welcome to *${groupName}*! 🎉\n\n` +
                               `> *Powered by XHUNTERBOT*`;
            }

            let sentWithImage = false;

            // Try sending welcome card image
            try {
                let profilePicUrl = `https://img.pyrocdn.com/dbKUgahg.png`;
                try {
                    const profilePic = await sock.profilePictureUrl(participantString, 'image');
                    if (profilePic) profilePicUrl = profilePic;
                } catch (e) {}

                const apiUrl = `https://api.some-random-api.com/welcome/img/2/gaming3?type=join&textcolor=green&username=${encodeURIComponent(displayName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${groupMetadata.participants.length}&avatar=${encodeURIComponent(profilePicUrl)}`;
                
                const response = await fetch(apiUrl);
                if (response.ok) {
                    const imageBuffer = await response.buffer();
                    
                    await sock.sendMessage(id, {
                        image: imageBuffer,
                        caption: finalMessage,
                        mentions: [participantString],
                        ...channelInfo
                    });
                    sentWithImage = true;
                }
            } catch (imageError) {
                console.log('Welcome image API failed, switching to text tag');
            }

            // Fallback to text if image was not sent
            if (!sentWithImage) {
                await sock.sendMessage(id, {
                    text: finalMessage,
                    mentions: [participantString],
                    ...channelInfo
                });
            }

        } catch (error) {
            console.error('Error sending welcome message:', error);
            const participantString = typeof participant === 'string' ? participant : (participant.id || participant.toString());
            const userNum = participantString.split('@')[0];

            await sock.sendMessage(id, {
                text: `Welcome @${userNum} to *${groupName}*! 🎉`,
                mentions: [participantString],
                ...channelInfo
            });
        }
    }
}

module.exports = { welcomeCommand, handleJoinEvent };