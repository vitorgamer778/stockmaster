<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1ZxWhPWSo34RPuhKTUwcnububxUX6NU28

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Logs de Auditoria

O app agora mantém um registro (audit log) de ações importantes do usuário — como login, criação/edição/exclusão de produtos, atualizações de estoque, importações e exportações, e gestão de usuários/abas. Os logs são salvos em `localStorage` e podem ser acessados no menu **Configurações (Master) → Ver Logs de Atividade**. É possível **exportar (JSON/CSV)** ou **limpar** os registros.

## Deploy (Vercel) — manter a API Gemini segura

Opções rápidas:

- Deploy via UI: Conecte o repositório no painel do Vercel, defina `GEMINI_API_KEY` em **Settings → Environment Variables**, e clique em **Deploy**.

- Deploy via CLI (exemplo):

1. Instale e faça login no Vercel:
   ```bash
   npm i -g vercel
   vercel login
   ```
2. Vincule o projeto (na pasta do repo):
   ```bash
   vercel link
   ```
3. Adicione a variável de ambiente `GEMINI_API_KEY` (por ambiente):
   ```bash
   vercel env add GEMINI_API_KEY production
   vercel env add GEMINI_API_KEY preview
   ```
4. Faça deploy:
   ```bash
   vercel --prod
   ```

Nota: A variável `GEMINI_API_KEY` **NUNCA** deve ficar no código cliente. O endpoint serverless `POST /api/extract` roda no servidor do Vercel e usa essa variável para chamar a API de IA.

Dica rápida: para testar localmente com o mesmo comportamento, use `vercel dev` e defina `GEMINI_API_KEY` no seu `.env`.

## Deploy automático via GitHub Actions (opcional)

Se preferir deploy automático quando `main` receber um push, siga estes passos:

1. Crie um token no Vercel:
   - Entre em https://vercel.com/account/tokens e gere um novo token (nomeie como `github-actions` ou similar).
2. Configure Secrets no seu repositório GitHub:
   - `VERCEL_TOKEN` → o token criado no passo anterior
   - `VERCEL_ORG_ID` → ID da sua organização (encontrado no dashboard do Vercel ou via `vercel projects`)
   - `VERCEL_PROJECT_ID` → ID do projeto do Vercel (disponível no dashboard ou via `vercel projects`)

3. Habilite a workflow criada (`.github/workflows/deploy.yml`). O deploy será disparado automaticamente ao fazer push em `main`.

Observação: o workflow usa o CLI do Vercel para fazer deploy. Certifique-se de que `GEMINI_API_KEY` esteja definida nas **Environment Variables** do projeto no Vercel (Settings → Environment Variables) para os ambientes `Preview` e `Production`.

Se quiser, eu posso ajudar a gerar os IDs do projeto e organização usando o `vercel` CLI localmente (você precisará executar os comandos com seu login Vercel), ou posso direcionar passo a passo para adicionar os secrets no GitHub UI.
