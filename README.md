# Bot Discord

Bot de Discord em Node.js com `discord.js`. Inclui o comando de barra `/ping` e moderação automática contra convites, spam repetido/rápido e excesso de menções.

## Requisitos

- Node.js 20 ou superior
- Uma aplicação e um bot criados no [Discord Developer Portal](https://discord.com/developers/applications)

## Configuração

1. No Developer Portal, crie uma aplicação, adicione um bot e copie o token.
2. Em **OAuth2 → General**, copie o **Application ID**.
3. Crie uma cópia de `.env.example` chamada `.env` e preencha `DISCORD_TOKEN` e `CLIENT_ID`.
4. Em **Bot → Privileged Gateway Intents**, ative **Message Content Intent**. O bot precisa ler o conteúdo das mensagens para detectar convites e spam.
5. Convide o bot com os escopos `bot` e `applications.commands`, concedendo as permissões **Manage Messages** e **Moderate Members**.
6. Instale dependências, registre os comandos e inicie o bot:

   ```bash
   npm install
   npm run deploy-commands
   npm start
   ```

Para testar os comandos imediatamente em um servidor, defina também `GUILD_ID` no `.env` (ID do servidor). Sem essa variável, `/ping` será registrado globalmente e pode demorar um pouco para aparecer.

## Moderação automática

O automod remove mensagens com convites do Discord, excesso de menções e spam (muitas mensagens em pouco tempo ou texto repetido). Spam e excesso de menções também aplicam timeout quando o bot tem permissão e consegue moderar o membro. Moderadores com **Manage Messages** são isentos. Ajuste no `.env`:

- `AUTOMOD_ENABLED=true` — defina `false` para desativar.
- `MAX_MENTIONS=5` — limite de usuários e cargos mencionados por mensagem.
- `SPAM_LIMIT=5` — mensagens no intervalo que ativam a detecção de flood.
- `SPAM_WINDOW_MS=8000` — intervalo de detecção em milissegundos.
- `TIMEOUT_SECONDS=60` — duração do timeout aplicado a spam/menções; `0` desativa o timeout.

Use limites adequados à sua comunidade e teste em um servidor antes de ativar. As permissões e a hierarquia de cargos do Discord ainda se aplicam.

Nunca compartilhe o token do bot nem o envie para o GitHub. Se ele for exposto, redefina-o no Developer Portal.
