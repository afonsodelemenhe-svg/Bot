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
const recentMessages = new Map();
const invitePattern = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/[\w-]+/i;

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot conectado como ${readyClient.user.tag}`);
  console.log(`Moderação automática ${automodEnabled ? 'ativada' : 'desativada'}.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== pingCommand.name) return;

  await interaction.reply('Pong!');
});

client.on(Events.MessageCreate, async (message) => {
  if (!automodEnabled || !message.inGuild() || message.author.bot) return;

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

  if (!containsInvite && !isFlood && !isMentionSpam) return;

  try {
    await message.delete();
    const reasons = [
      containsInvite && 'link de convite',
      isFlood && 'spam',
      isMentionSpam && 'menções excessivas',
    ].filter(Boolean).join(', ');
    console.log(`Automod removeu mensagem de ${message.author.tag} em ${message.guild.name}: ${reasons}.`);

    if ((isFlood || isMentionSpam) && timeoutSeconds > 0 && message.member?.moderatable) {
      await message.member.timeout(timeoutSeconds * 1000, `Moderação automática: ${reasons}`);
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
