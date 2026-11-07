# Bot Discord

Um bot simples para Discord, feito em Node.js com `discord.js`. Ele oferece o comando de barra `/ping`, que responde com `Pong!`.

## Requisitos

- Node.js 20 ou superior
- Uma aplicação e um bot criados no [Discord Developer Portal](https://discord.com/developers/applications)

## Configuração

1. No Developer Portal, crie uma aplicação, adicione um bot e copie o token.
2. Em **OAuth2 → General**, copie o **Application ID**.
3. Crie uma cópia de `.env.example` chamada `.env` e preencha `DISCORD_TOKEN` e `CLIENT_ID`.
4. Instale as dependências e registre o comando:

   ```bash
   npm install
   npm run deploy-commands
   npm start
   ```

Para testar os comandos imediatamente em um servidor, defina também `GUILD_ID` no `.env` (ID do servidor). Sem essa variável, `/ping` será registrado globalmente e pode demorar um pouco para aparecer.

Nunca compartilhe o token do bot nem o envie para o GitHub. Se ele for exposto, redefina-o no Developer Portal.

## Comandos

- `/ping` — verifica se o bot está online.

## Convidar o bot

No Developer Portal, abra **OAuth2 → URL Generator**, selecione os escopos `bot` e `applications.commands`, escolha as permissões necessárias e use a URL gerada para adicioná-lo ao servidor. O bot precisa estar em execução para responder.
