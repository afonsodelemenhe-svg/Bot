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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot conectado como ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== pingCommand.name) return;

  await interaction.reply('Pong!');
});

process.on('SIGINT', () => {
  client.destroy();
  process.exit(0);
});

client.login(token).catch((error) => {
  console.error('Não foi possível conectar o bot. Verifique o DISCORD_TOKEN.', error);
  process.exit(1);
});
