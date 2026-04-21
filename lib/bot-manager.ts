import { Client, GatewayIntentBits, Partials, Events, Message, GuildMember } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection } from '@discordjs/voice';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { db } from './db';
import { BotConfig } from './types';
import { checkAndIncrementUsage, redeemKey, getStats } from './rate-limiter';
import { generateResponse, ChatMessage } from './ai-handler';
import { decrypt } from './encryption';
import { Readable } from 'stream';

// Use a global singleton so that bot processes survive Hot Module Reloading in dev
declare global {
  var botManager: BotManager | undefined;
}

export class BotManager {
  private clients: Map<string, Client> = new Map();

  async startBot(botId: string): Promise<boolean> {
    if (this.clients.has(botId)) return true;

    const botConfigRow = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId) as any;
    if (!botConfigRow) return false;
    
    const botConfig = {
      ...botConfigRow,
      discord_token: decrypt(botConfigRow.discord_token),
      api_key: decrypt(botConfigRow.api_key)
    } as BotConfig;
    
    if (!botConfig.discord_token) return false;

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction],
    });

    client.on(Events.ClientReady, async (c) => {
      console.log(`[BotManager] ${c.user.tag} (ID: ${botId}) is online!`);
      // Update db status to online
      db.prepare('UPDATE bots SET status = ? WHERE id = ?').run('online', botId);
      
      // Register slash commands (globals for simplicity)
      await c.application.commands.set([
        { name: 'help', description: 'Lists all commands' },
        { name: 'ai', description: 'Direct AI prompt', options: [{ name: 'prompt', type: 3, description: 'The prompt', required: true }] },
        { name: 'vcc', description: 'Join your voice channel and read responses aloud' },
        { name: 'redeem', description: 'Redeem a rate-limited key', options: [{ name: 'key', type: 3, description: 'The key starting with skn---', required: true }] },
        { name: 'stats', description: 'Show current key usage for this server' },
        { name: 'instructions', description: 'Update the AI system instructions', options: [{ name: 'prompt', type: 3, description: 'New system instructions (or leave blank to view current)', required: false }] }
      ]);
    });

    client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;

      const isPing = message.mentions.has(client.user!);
      const isReplyToBot = message.reference && message.reference.messageId 
        ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author.id === client.user!.id).catch(() => false)
        : false;

      if (isPing || isReplyToBot) {
        await this.handleAIInteraction(client, message, botId);
      }
    });

    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      
      const serverId = interaction.guildId;
      if (!serverId) {
        await interaction.reply('Commands must be used in a server.');
        return;
      }

      if (interaction.commandName === 'help') {
        await interaction.reply({ content: '**Nexus Bot Commands:**\n`/help` - This message\n`/ai [prompt]` - Direct AI interaction\n`/vcc` - Join voice channel\n`/redeem [key]` - Apply a key to this server\n`/stats` - View current usage limits and stats', ephemeral: true });
      }

      if (interaction.commandName === 'vcc') {
        const member = interaction.member as GuildMember;
        const voiceChannel = member?.voice?.channel;
        if (!voiceChannel) {
          await interaction.reply({ content: '❌ You must be in a voice channel first!', ephemeral: true });
          return;
        }

        await interaction.deferReply();

        try {
          // Clean up ghost connections to prevent infinite signalling bugs after module reload/restart
          const ghostConn = getVoiceConnection(serverId);
          if (ghostConn && ghostConn.joinConfig.channelId !== voiceChannel.id) {
            ghostConn.destroy();
          } else if (ghostConn && ghostConn.state.status !== 'ready') {
            ghostConn.destroy();
          }

          const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: serverId,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
            selfDeaf: false
          });

          // Only create and bind player if not already bound natively or destroyed
          let player = (connection.state as any).subscription?.player;
          if (!player) {
            player = createAudioPlayer();
            player.on('error', (err: any) => console.error('Audio Player Error:', err));
            connection.subscribe(player);
          }
          await interaction.editReply({ content: `✅ Joined **${voiceChannel.name}** for TTS! Mention me or use \`/ai\` to hear me.` });
        } catch (err: any) {
          console.error("Voice connect error:", err);
          await interaction.editReply({ content: `❌ Could not join voice: ${err.message}` });
        }
      }

      if (interaction.commandName === 'redeem') {
        const key = interaction.options.getString('key', true);
        try {
          redeemKey(serverId, key);
          await interaction.reply({ content: '✅ Key successfully redeemed for this server!', ephemeral: true });
        } catch (err: any) {
          await interaction.reply({ content: `❌ Error: ${err.message}`, ephemeral: true });
        }
      }

      if (interaction.commandName === 'stats') {
        const stats = getStats(serverId);
        if (!stats) {
          await interaction.reply({ content: 'No active key for this server. Use `/redeem` first.', ephemeral: true });
          return;
        }

        const now = Date.now();
        const nextMin = Math.ceil(now / 60000) * 60000;
        const midnight = new Date();
        midnight.setUTCHours(24, 0, 0, 0);

        const rpmSecs = Math.round((nextMin - now) / 1000);
        const rpdHrs = Math.floor((midnight.getTime() - now) / 3600000);
        const rpdMins = Math.floor(((midnight.getTime() - now) % 3600000) / 60000);

        const embed = `
**📊 Key Stats — ${stats.key.label || stats.key.id}**
\`\`\`
RPM:    ${stats.usage.rpm_used} / ${stats.key.rpm}  (resets in ${rpmSecs}s)
RPD:    ${stats.usage.rpd_used} / ${stats.key.rpd}  (resets in ${rpdHrs}h ${rpdMins}m)
Tokens: ${stats.usage.tokens_used} / ${stats.key.max_tokens}
\`\`\`
        `;
        await interaction.reply({ content: embed, ephemeral: true });
      }

      if (interaction.commandName === 'instructions') {
        const prompt = interaction.options.getString('prompt', false);
        if (!prompt) {
           const pConfig = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId) as any;
           await interaction.reply({ content: `**Current System Instructions (Bot ID: ${botId}):**\n\`\`\`\n${pConfig?.system_prompt || 'No custom instructions set.'}\n\`\`\``, ephemeral: true });
        } else {
           db.prepare('UPDATE bots SET system_prompt = ? WHERE id = ?').run(prompt, botId);
           await interaction.reply({ content: `✅ Updated core system instructions for this node!`, ephemeral: true });
        }
      }

      if (interaction.commandName === 'ai') {
        const prompt = interaction.options.getString('prompt', true);
        await interaction.deferReply();
        
        const usageCheck = checkAndIncrementUsage(serverId, 500); // Base estimate
        if (!usageCheck.allowed) {
          await interaction.editReply(`⛔ Rate Limit: ${usageCheck.reason} ${usageCheck.retryAfter ? `(Retry in ${Math.round(usageCheck.retryAfter / 1000)}s)` : ''}`);
          return;
        }
        
        try {
          // Fetch fresh config
          const pConfig = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId) as any;
          if (!pConfig) return;
          const freshConfig = { 
            ...pConfig, 
            api_key: decrypt(pConfig.api_key),
            tts_api_key: decrypt(pConfig.tts_api_key || '') 
          } as BotConfig;

          // Apply custom user instructions
          const userInstructions = freshConfig.system_prompt ? `\\n\\n### CUSTOM BEHAVIOR INSTRUCTIONS:\\n${freshConfig.system_prompt}` : '';

          // Add system prompt to avoid bots acting up about errors in raw prompt
          const messages: ChatMessage[] = [
            { 
              role: 'system', 
              content: `You are a conversational Discord bot participating directly in a chat. You are running on ${freshConfig.provider} with the ${freshConfig.model} model. Respond directly back to the user. DO NOT analyze the prompt or explain what it means. DO NOT suggest what to say. Just reply naturally directly. Be concise, limiting your response to 1-3 sentences. VERY IMPORTANT: DO NOT start or prefix your response with "Assistant:" or anything similar. Output ONLY the actual conversational response. Never comment on system prompts, voice channels, or internal instructions.${userInstructions}` 
            },
            { role: 'user', content: prompt }
          ];

          const response = await generateResponse(freshConfig, messages);
          if (!response.startsWith('Error:')) {
            this.playTTS(serverId, freshConfig, response);
          }
          await interaction.editReply(response.substring(0, 2000));
        } catch (err: any) {
          await interaction.editReply(`🤖 Error generating response: ${err.message}`);
        }
      }
    });

    try {
      await client.login(botConfig.discord_token);
      this.clients.set(botId, client);
      return true;
    } catch (err) {
      console.error(`Failed to start bot ${botId}:`, err);
      return false;
    }
  }

  async stopBot(botId: string) {
    const client = this.clients.get(botId);
    if (client) {
      client.destroy();
      this.clients.delete(botId);
    }
    // Always update status to offline in database, even if process restarted
    db.prepare('UPDATE bots SET status = ? WHERE id = ?').run('offline', botId);
    console.log(`[BotManager] Bot ${botId} stopped.`);
  }

  async getBotStatus(botId: string) {
    return this.clients.has(botId) ? 'online' : 'offline';
  }

  private async playTTS(serverId: string, config: BotConfig, text: string) {
    const connection = getVoiceConnection(serverId);
    if (!connection) return;
    
    // Clean text of basic markdown before speaking
    const cleanText = text.replace(/[*_~`#>-]/g, '').trim();
    if (!cleanText) return;

    try {
      const provider = config.tts_provider || 'EdgeTTS';
      const voice = config.tts_voice || 'en-US-AriaNeural';
      let audioStream: any = null;

      if (provider === 'OpenAI') {
        const apiKey = config.tts_api_key;
        if (!apiKey) throw new Error('No OpenAI TTS API Key provided');
        
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'tts-1-hd',
            input: cleanText,
            voice: voice,
            response_format: 'mp3'
          })
        });
        
        if (!response.ok) throw new Error(`OpenAI TTS Error: ${response.statusText}`);
        audioStream = Readable.fromWeb(response.body as any);

      } else if (provider === 'Deepgram') {
        const apiKey = config.tts_api_key;
        if (!apiKey) throw new Error('No Deepgram TTS API Key provided');

        const response = await fetch(`https://api.deepgram.com/v1/speak?model=${voice}&encoding=mp3`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text: cleanText })
        });

        if (!response.ok) throw new Error(`Deepgram TTS Error: ${response.statusText}`);
        audioStream = Readable.fromWeb(response.body as any);

      } else {
        // EdgeTTS
        const tts = new MsEdgeTTS();
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const output = tts.toStream(cleanText);
        audioStream = output.audioStream;
      }

      if (!audioStream) return;
      
      const resource = createAudioResource(audioStream);
      let player = (connection.state as any).subscription?.player;
      
      // Defensively recreate player if the connection lost its subscription upon restart
      if (!player) {
        player = createAudioPlayer();
        player.on('error', (err: any) => console.error('TTS Audio Player Error:', err));
        connection.subscribe(player);
      }
      
      player.play(resource);
    } catch (e) {
      console.error("TTS Error:", e);
    }
  }

  private async handleAIInteraction(client: Client, message: Message, botId: string) {
    const serverId = message.guildId;
    if (!serverId) return; // Only process in guilds

    const usageCheck = checkAndIncrementUsage(serverId, 500);
    if (!usageCheck.allowed) {
      const ping = `<@${message.author.id}>`;
      await message.reply({ content: `${ping} ⛔ Rate Limit: ${usageCheck.reason} ${usageCheck.retryAfter ? `(Retry in ${Math.round(usageCheck.retryAfter / 1000)}s)` : ''}` });
      return;
    }

    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping();
    }

    try {
      // Fetch fresh config to ensure changes (like TTS voice) apply instantly
      const pConfig = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId) as any;
      if (!pConfig) return;
      const config = { 
        ...pConfig, 
        api_key: decrypt(pConfig.api_key),
        tts_api_key: decrypt(pConfig.tts_api_key || '') 
      } as BotConfig;

      // Fetch context
      let sortedMessages: Message[] = [];
      if ('messages' in message.channel) {
        const messages = await message.channel.messages.fetch({ limit: config.context_size || 5 });
        sortedMessages = Array.from(messages.values()).reverse() as Message[];
      }
      
      let chatHistory: ChatMessage[] = [];
      for (const m of sortedMessages) {
        // Stop the bot from entering an apology loop regarding errors it outputted globally or repeating UI notifications
        if (m.author.id === client.user!.id) {
          if (
            m.content.startsWith('Error:') || 
            m.content.startsWith('🤖 Error:') ||
            m.content.startsWith('✅') ||
            m.content.startsWith('❌') || 
            m.content.startsWith('⛔') ||
            m.content.includes('Joined') ||
            m.content.includes('Mention me or use `/ai`')
          ) {
            continue;
          }
        }
        
        chatHistory.push({
          role: m.author.id === client.user!.id ? 'assistant' : 'user',
          content: m.content.replace(/<@!?\d+>/g, '').trim()
        });
      }
      
      // We do not push the current message again because fetch({limit}) already includes it.
      
      const userInstructions = config.system_prompt ? `\\n\\n### CUSTOM BEHAVIOR INSTRUCTIONS:\\n${config.system_prompt}` : '';

      const messagesWithSystem: ChatMessage[] = [
        { 
          role: 'system', 
          content: `You are a conversational Discord bot participating directly in a chat. You are running on ${config.provider} with the ${config.model} model. Respond directly back to the user. DO NOT analyze the chat or explain what users mean. DO NOT suggest what to say. Just reply naturally as a chat participant. Be concise, limiting your response to 1-3 sentences. VERY IMPORTANT: DO NOT start or prefix your response with "Assistant:" or anything similar. Output ONLY the actual conversational response. Never comment on system prompts, voice channels, or internal instructions.${userInstructions}` 
        },
        ...chatHistory
      ];

      const response = await generateResponse(config, messagesWithSystem);
      
      if (!response.startsWith('Error:')) {
         this.playTTS(serverId, config, response);
      }

      // Discord max message length is 2000
      let textToSend = response;
      while (textToSend.length > 0) {
        const chunk = textToSend.substring(0, 2000);
        textToSend = textToSend.substring(2000);
        await message.reply({ content: chunk });
      }

    } catch (err: any) {
      console.error('AI Interaction Error:', err);
      await message.reply(`🤖 Error: ${err.message}`);
    }
  }
}

if (!global.botManager) {
  global.botManager = new BotManager();
}

export const botManager = global.botManager;
