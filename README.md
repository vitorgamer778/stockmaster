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

1. Faça login no Vercel e conecte este repositório (ou use `vercel` CLI).
2. Defina a variável de ambiente `GEMINI_API_KEY` no painel de **Environment Variables** do projeto (não exponha a chave no frontend).
3. Deploy: o Vercel criará um endpoint serverless `/api/extract` que o frontend usa para enviar arquivos (base64) e receber a resposta da IA.

Observação: localmente, você pode testar o endpoint usando `vercel dev` ou definindo `GEMINI_API_KEY` no seu `.env` durante o desenvolvimento.
