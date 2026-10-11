# Salvar cadastros e contas de luz (Google Sheets + Drive)

Quando a pessoa envia o formulário, o site:

1. manda os dados (e a conta de luz anexada) para a URL em `VITE_LEAD_ENDPOINT`;
2. abre o WhatsApp da Eletrodara com todos os dados preenchidos **e o link da conta de luz**.

Sem essa URL configurada, o site ainda abre o WhatsApp com os dados, mas a conta não vai junto (a pessoa precisa anexar manualmente no chat) e nada fica registrado na planilha.

## 1. Criar a planilha

1. Crie uma planilha no Google Sheets (ex.: "Cadastros Eletrodara") **com a conta Google da empresa**.
2. Na primeira linha, coloque: `Data | Nome | WhatsApp | Cidade | Distribuidora | Conta média | Economia/mês | Conta de luz | Origem`.

## 2. Criar o script

1. Na planilha, abra **Extensões → Apps Script**.
2. Apague o conteúdo e cole:

```js
const FOLDER_NAME = 'Contas de luz - Cadastros';

function getFolder() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function doPost(e) {
  const lead = JSON.parse(e.postData.contents);
  let fileUrl = '';

  if (lead.file && lead.file.data) {
    const blob = Utilities.newBlob(
      Utilities.base64Decode(lead.file.data),
      lead.file.type || 'application/octet-stream',
      `${lead.name} - ${lead.file.name}`
    );
    fileUrl = getFolder().createFile(blob).getUrl();
  }

  SpreadsheetApp.getActiveSpreadsheet().getSheets()[0].appendRow([
    new Date(lead.createdAt),
    lead.name,
    lead.phone,
    lead.city,
    lead.distributor,
    lead.billValue,
    lead.monthlySavings,
    fileUrl,
    lead.source,
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, fileUrl }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Clique em **Implantar → Nova implantação → Tipo: App da Web**.
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
4. Autorize o acesso (Planilhas e Drive) e copie a URL gerada (termina em `/exec`).

> As contas ficam **privadas** na pasta do Drive da empresa. O link que chega no WhatsApp só abre para quem estiver logado nessa conta Google (ou com quem a pasta for compartilhada) — dados de conta de luz são pessoais (LGPD), então não deixe a pasta pública.

## 3. Configurar o site

Crie um arquivo `.env` na raiz do projeto (veja `.env.example`):

```
VITE_LEAD_ENDPOINT=https://script.google.com/macros/s/SEU_ID/exec
```

Reinicie o `npm run dev` (ou refaça o build) para valer. No deploy (Coolify, Vercel etc.), cadastre a mesma variável nas configurações do projeto **antes do build**.

Se alterar o script depois, use **Implantar → Gerenciar implantações → Editar → Nova versão** para manter a mesma URL.
