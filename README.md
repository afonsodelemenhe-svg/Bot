# Bot Discord

Bot de Discord em Node.js com `discord.js`. Inclui o comando de barra `/ping`, moderação automática contra convites/spam/menções e classificação de texto com a OpenAI Moderation API.

## Requisitos

- Node.js 20 ou superior
- Uma aplicação e um bot criados no [Discord Developer Portal](https://discord.com/developers/applications)
- Uma chave da API da OpenAI para habilitar a moderação com IA

## Configuração

1. No Developer Portal, crie uma aplicação, adicione um bot e copie o token.
2. Em **OAuth2 → General**, copie o **Application ID**.
3. Crie uma cópia de `.env.example` chamada `.env` e preencha `DISCORD_TOKEN`, `CLIENT_ID` e `OPENAI_API_KEY`.
4. Em **Bot → Privileged Gateway Intents**, ative **Message Content Intent**. O bot precisa ler o conteúdo das mensagens para detectar convites, spam e classificar texto.
5. Convide o bot com os escopos `bot` e `applications.commands`, concedendo as permissões **Manage Messages** e **Moderate Members**.
6. Instale dependências, registre os comandos e inicie o bot:

   ```bash
   npm install
   npm run deploy-commands
   npm start
   ```

Para testar os comandos imediatamente em um servidor, defina também `GUILD_ID` no `.env` (ID do servidor). Sem essa variável, `/ping` será registrado globalmente e pode demorar um pouco para aparecer.

## Moderação automática

As regras locais removem convites do Discord, excesso de menções e spam (muitas mensagens em pouco tempo ou texto repetido). Spam e excesso de menções também aplicam timeout. Moderadores com **Manage Messages** são isentos.

Com `OPENAI_API_KEY` configurada, as mensagens também são verificadas pela OpenAI Moderation API usando o modelo definido em `OPENAI_MODERATION_MODEL`. Mensagens sinalizadas são removidas. Por padrão, a classificação por IA não aplica timeout; configure `AI_MODERATION_TIMEOUT_SECONDS` para um valor maior que zero se desejar isso. Ajuste no `.env`:

- `AUTOMOD_ENABLED=true` — ativa/desativa as regras locais e a verificação de IA.
- `OPENAI_API_KEY` — chave secreta da API; mantenha apenas no `.env`, nunca no GitHub.
- `OPENAI_MODERATION_MODEL=omni-moderation-latest` — modelo de moderação.
- `AI_MODERATION_ENABLED=true` — defina `false` para desativar a verificação com IA.
- `AI_MODERATION_TIMEOUT_SECONDS=0` — duração do timeout para conteúdo sinalizado pela IA; `0` desativa o timeout.
- `MAX_MENTIONS=5` — limite de usuários e cargos mencionados por mensagem.
- `SPAM_LIMIT=5` — mensagens no intervalo que ativam a detecção de flood.
- `SPAM_WINDOW_MS=8000` — intervalo de detecção em milissegundos.
- `TIMEOUT_SECONDS=60` — duração do timeout aplicado a spam/menções.

Se a API estiver indisponível, a checagem de IA falha em aberto (não remove mensagens apenas por erro de conexão), enquanto as regras locais continuam funcionando. Verifique os termos e custos aplicáveis à sua conta de API. Teste os limites no servidor antes de ativar, pois a moderação automática pode sinalizar conteúdo legítimo. As permissões e a hierarquia de cargos do Discord ainda se aplicam.

Nunca compartilhe o token do bot nem as chaves da API. Se forem expostos, revogue-os e gere novos.
