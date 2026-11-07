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
const moderationDmEnabled = process.env.MODERATION_DM_ENABLED !== 'false';
const maxMentions = Number.parseInt(process.env.MAX_MENTIONS ?? '5', 10);
const spamLimit = Number.parseInt(process.env.SPAM_LIMIT ?? '5', 10);
const spamWindowMs = Number.parseInt(process.env.SPAM_WINDOW_MS ?? '8000', 10);
const timeoutSeconds = Number.parseInt(process.env.TIMEOUT_SECONDS ?? '60', 10);
const aiModerationEnabled = process.env.AI_MODERATION_ENABLED !== 'false' && Boolean(process.env.OPENAI_API_KEY);
const aiTimeoutSeconds = Number.parseInt(process.env.AI_MODERATION_TIMEOUT_SECONDS ?? '0', 10);
const recentMessages = new Map();
const invitePattern = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/[\w-]+/i;

function formatModerationNotice({ user, reason, channel, action }) {
  return `🛡️・AVISO DE MODERAÇÃO AUTOMÁTICA

Tribunal do Roblox 🚀 Tutorial & Discord

Olá, ${user}! 👋

O nosso sistema de moderação automática detetou uma possível violação das regras do servidor.

📋・DETALHES DA INFRAÇÃO

«👤 Utilizador: ${user}
⚠️ Infração: ${reason}
📍 Canal: ${channel}
🔨 Medida aplicada: ${action}»

📚・REGRAS DA COMUNIDADE

1. <:icons_1:1066773560019918978> Respeito é a nossa base

Não são permitidos discurso de ódio, discriminação, assédio ou humilhação de outros membros.

2. <:icons_2:1066773604798316544> Mantenha o conteúdo limpo

É proibido publicar conteúdo NSFW, sexual, impróprio ou referências a extremismos.

3. <:icons_3:1066773662025404507> Mantenha a ordem

Spam, flood, mensagens repetidas, correntes e abuso nos canais de voz não são permitidos.

4. <:icons_4:1066773705612603632> Sem divulgação não autorizada

Publicidade, convites, vendas e autopromoção só são permitidos nos canais autorizados.

5. <:icons_5:1066773745877909524> Proteja a sua privacidade

Nunca partilhe palavras-passe, documentos, moradas, números de telefone ou outros dados pessoais.

6. <:icons_6:1066773792191422524> Feedback construtivo

Sugestões e reclamações devem ser encaminhadas para a categoria de Suporte, com respeito.

7. <:icons_7:1066773902505820180> Idade mínima 13+

É obrigatório cumprir os requisitos de idade do Discord e os seus Termos de Serviço.

⚖️・SISTEMA DE PUNIÇÕES

As medidas podem incluir:

- ⚠️ Advertência (Warn)
- 🗑️ Remoção de mensagens
- 🔇 Silenciamento (Mute / Timeout)
- 🚪 Expulsão (Kick)
- 🔨 Banimento (Ban)

A medida aplicada depende da gravidade e da repetição das infrações.

📩・QUERES CONTESTAR A PUNIÇÃO?

Se consideras que esta ação foi aplicada por engano, contacta a equipa Staff através do canal de Suporte.

🚫 Não utilizes contas alternativas para contornar punições.

❤️ Agradecemos a tua colaboração para manter o nosso servidor seguro e organizado!

— Equipa Staff
Tribunal do Roblox 🚀 Tutorial & Discord`;
}

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

    if (moderationDmEnabled) {
      const action = shouldTimeout ? `Silenciamento (Timeout ${durationSeconds}s)` : 'Remoção de mensagens';
      const notice = formatModerationNotice({
        user: message.author.tag,
        reason: reasons,
        channel: `#${message.channel.name}`,
        action,
      });

      try {
        await message.author.send(notice);
      } catch (error) {
        console.warn(`Não foi possível enviar aviso por DM para ${message.author.tag}.`, error);
      }
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

