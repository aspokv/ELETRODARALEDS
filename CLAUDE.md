# CLAUDE.md

Landing page de cadastros da Eletrodara + painel (`/painel`). Detalhes de estrutura no README.

## Deploy (Coolify)

- Painel do Coolify: https://panel.aiexec.com.br
- App: `eletrodara-landing` — uuid `efukjhwk7cltugg7laoyim5d`
- Site no ar: https://eletrodara.aiexec.com.br — painel em https://eletrodara.aiexec.com.br/painel (usuário `eletrodara`)
- **Push na `main` não publica sozinho.** Depois do push, dispare o deploy:
  ```bash
  curl -X POST -H "Authorization: Bearer $COOLIFY_TOKEN" -H "Content-Type: application/json" \
    -d '{"uuid":"efukjhwk7cltugg7laoyim5d","force":false}' https://panel.aiexec.com.br/api/v1/deploy
  ```
  e acompanhe em `GET /api/v1/deployments/<deployment_uuid>` (campo `status`).
- Token da API: Coolify → Keys & Tokens → API Tokens (permissão root). Não fica no repositório.
- Variáveis no Coolify: `ADMIN_PASSWORD` (senha do painel; trocar = mudar a variável + redeploy). A API não devolve o valor das variáveis.
- Dados (cadastros e contas) ficam no volume `/data` do container.

## Pontos de configuração

- Número do WhatsApp do site: `whatsappNumber` e `phoneFormatted` em `src/config/site.js` (README repete o número).
- Links de parceiro `/p/<slug>` usam o WhatsApp do parceiro, cadastrado no painel (fica em `/data`, não no código).

## Verificar antes de publicar

```bash
npm ci && npm run build   # o número novo tem que aparecer em dist/assets/*.js
```
