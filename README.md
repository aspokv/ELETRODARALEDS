# Eletrodara — Energia Solar por Assinatura

Landing page de captação de cadastros da **Eletrodara Gestão de Energia**. Foco único: cadastro gratuito rápido (nome, WhatsApp, cidade e faixa da conta de luz).

---

## ⚡ Estrutura

- **Hero + formulário de cadastro** acima da dobra.
- **Cadastros e contas salvos no próprio servidor** (`server/server.mjs`, sem dependências). A mensagem do WhatsApp leva o link da conta.
- **Painel** em `/painel` (login por usuário/senha):
  - **Admin** (`ADMIN_USER`/`ADMIN_PASSWORD`): vê tudo — cadastros, kWh/mês (estimado e confirmado), ativados, ranking de parceiros, filtros, exportação CSV; cadastra parceiros e ajusta a tarifa média.
  - **Parceiro**: link próprio `/p/<slug>` (o cliente cai no WhatsApp dele) e vê/atualiza só os próprios cadastros.
  - Contas de luz são apagadas sozinhas após 30 dias.
- **Como funciona** em 3 passos, **perguntas frequentes** e dados institucionais.
- Textos e dados da empresa centralizados em `src/config/site.js`.

---

## 🛠️ Stack Tecnológica

- **Frontend**: React 19 + Vite 8
- **Estilização**: Tailwind CSS 3.4

---

## 🚀 Como Executar

### 1. Instalar Dependências
```bash
npm install
```

### 2. Rodar em Desenvolvimento
Em dois terminais:
```bash
npm run server   # API + painel na porta 3001 (dados em ./data)
npm run dev      # site com proxy para a API
```
Acesse [http://localhost:5173](http://localhost:5173). Para usar o painel localmente, defina `ADMIN_PASSWORD` antes de `npm run server`.

### 3. Produção
O Dockerfile gera o site e roda `node server/server.mjs` na porta 80. Variáveis:

- `ADMIN_PASSWORD` — senha do painel (`/painel`, usuário `eletrodara` ou `ADMIN_USER`). Sem ela o painel fica desativado.
- `FILE_RETENTION_DAYS` — dias até a conta ser apagada sozinha (padrão 30).
- Monte um volume persistente em `/data` (cadastros e contas).

---

## 📄 Dados Institucionais
- **Empresa**: Eletrodara Gestão de Energia Ltda.
- **CNPJ**: 61.326.080/0001-64
- **Sede**: Parque Tecnológico TecnoUCS — Universidade de Caxias do Sul / RS
- **WhatsApp Oficial**: (19) 99594-9292
