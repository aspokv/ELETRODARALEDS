# Eletrodara — Energia Solar por Assinatura

Landing page de captação de cadastros da **Eletrodara Gestão de Energia**. Foco único: cadastro gratuito rápido (nome, WhatsApp, cidade e faixa da conta de luz).

---

## ⚡ Estrutura

- **Hero + formulário de cadastro** acima da dobra.
- **Cadastros salvos** numa planilha Google via Apps Script (veja [docs/google-sheets.md](docs/google-sheets.md)); após o cadastro, a pessoa pode seguir para o WhatsApp com a mensagem pronta.
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

### 2. Configurar onde salvar os cadastros
Copie `.env.example` para `.env` e preencha `VITE_LEAD_ENDPOINT` (passo a passo em [docs/google-sheets.md](docs/google-sheets.md)).

### 3. Rodar em Desenvolvimento
```bash
npm run dev
```
Acesse [http://localhost:5173](http://localhost:5173).

### 4. Build de Produção
```bash
npm run build
```

---

## 📄 Dados Institucionais
- **Empresa**: Eletrodara Gestão de Energia Ltda.
- **CNPJ**: 61.326.080/0001-64
- **Sede**: Parque Tecnológico TecnoUCS — Universidade de Caxias do Sul / RS
- **WhatsApp Oficial**: (54) 99714-3102
