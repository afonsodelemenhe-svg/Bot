import 'dotenv/config';
import { Client, Events, GatewayIntentBits, SlashCommandBuilder } from 'discord.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('A variável DISCORD_TOKEN não foi definida. Configure o arquivo .env.');
  process.exit(1);
}

const pingCommand = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Verifica se o bot está online.');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const automodEnabled = process.env.AUTOMOD_ENABLED !== 'false';
const maxMentions = Number.parseInt(process.env.MAX_MENTIONS ?? '5', 10);
const spamLimit = Number.parseInt(process.env.SPAM_LIMIT ?? '5', 10);
const spamWindowMs = Number.parseInt(process.env.SPAM_WINDOW_MS ?? '8000', 10);
const timeoutSeconds = Number.parseInt(process.env.TIMEOUT_SECONDS ?? '60', 10);
const aiModerationEnabled = process.env.AI_MODERATION_ENABLED !== 'false' && Boolean(process.env.OPENAI_API_KEY);
const aiTimeoutSeconds = Number.parseInt(process.env.AI_MODERATION_TIMEOUT_SECONDS ?? '0', 10);
const recentMessages = new Map();
const invitePattern = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/[\w-]+/i;

async function checkWithAiModeration(text) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest',
        input: text.slice(0, 10000),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI Moderation API respondeu com HTTP ${response.status}`);
    }

    const result = (await response.json()).results?.[0];
    return {
      flagged: result?.flagged === true,
      categories: Object.entries(result?.categories ?? {})
        .filter(([, flagged]) => flagged)
        .map(([category]) => category),
    };
  } finally {
    clearTimeout(timeout);
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot conectado como ${readyClient.user.tag}`);
  console.log(`Moderação automática ${automodEnabled ? 'ativada' : 'desativada'}.`);
  console.log(`Moderação com IA ${aiModerationEnabled ? 'ativada' : 'desativada (configure OPENAI_API_KEY).'}.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== pingCommand.name) return;

  await interaction.reply('Pong!');
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.inGuild() || message.author.bot) return;
  if (message.member?.permissions.has('ManageMessages')) return;

  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  const containsInvite = invitePattern.test(message.content);
  const now = Date.now();
  const key = `${message.guildId}:${message.author.id}`;
  const recent = (recentMessages.get(key) ?? []).filter((entry) => now - entry.timestamp < spamWindowMs);
  const normalizedContent = message.content.trim().toLowerCase();
  recent.push({ timestamp: now, content: normalizedContent });
  recentMessages.set(key, recent);

  const repeatedCount = recent.filter((entry) => entry.content === normalizedContent).length;
  const isFlood = recent.length >= spamLimit || repeatedCount >= 3;
  const isMentionSpam = maxMentions > 0 && mentionCount >= maxMentions;

  let aiResult = { flagged: false, categories: [] };
  if (automodEnabled && aiModerationEnabled && message.content.trim()) {
    try {
      aiResult = await checkWithAiModeration(message.content);
    } catch (error) {
      // Fail open on API/network errors: conventional rules below still apply.
      console.error('Falha ao verificar a mensagem com a moderação de IA.', error);
    }
  }

  const ruleViolation = automodEnabled && (containsInvite || isFlood || isMentionSpam);
  if (!ruleViolation && !aiResult.flagged) return;

  try {
    await message.delete();
    const reasons = [
      containsInvite && 'link de convite',
      isFlood && 'spam',
      isMentionSpam && 'menções excessivas',
      aiResult.flagged && `conteúdo sinalizado pela IA${aiResult.categories.length ? ` (${aiResult.categories.join(', ')})` : ''}`,
    ].filter(Boolean).join(', ');
    console.log(`Automod removeu mensagem de ${message.author.tag} em ${message.guild.name}: ${reasons}.`);

    const shouldTimeout = (isFlood || isMentionSpam) && timeoutSeconds > 0
      || aiResult.flagged && aiTimeoutSeconds > 0;
    const durationSeconds = aiResult.flagged && aiTimeoutSeconds > 0
      ? aiTimeoutSeconds
      : timeoutSeconds;

    if (shouldTimeout && message.member?.moderatable) {
      await message.member.timeout(durationSeconds * 1000, `Moderação automática: ${reasons}`);
    }
  } catch (error) {
    console.error(`Automod não conseguiu moderar a mensagem em ${message.guild.name}.`, error);
  }
});

process.on('SIGINT', () => {
  client.destroy();
  process.exit(0);
});

client.login(token).catch((error) => {
  console.error('Não foi possível conectar o bot. Verifique o DISCORD_TOKEN.', error);
  process.exit(1);
});
