import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Defina DISCORD_TOKEN e CLIENT_ID no arquivo .env.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Verifica se o bot está online.')
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
const route = GUILD_ID
  ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
  : Routes.applicationCommands(CLIENT_ID);

try {
  await rest.put(route, { body: commands });
  console.log(`Comandos registrados ${GUILD_ID ? `no servidor ${GUILD_ID}` : 'globalmente'}.`);
} catch (error) {
  console.error('Falha ao registrar os comandos. Verifique CLIENT_ID, GUILD_ID e o token.', error);
  process.exit(1);
}
