export const SITE_CONFIG = {
  company: "Eletrodara Gestão de Energia Ltda.",
  whatsappNumber: "5554984123939",
  phoneFormatted: "(54) 98412-3939",
  cnpj: "61.326.080/0001-64",
  headquarters: "Parque Tecnológico TecnoUCS — Universidade de Caxias do Sul / RS",
  minDiscount: 20,
  maxDiscount: 25,

  // Rota do servidor (server/server.mjs) que salva cadastros e contas.
  leadEndpoint: "/api/leads",

  // Simulador
  minBill: 250,
  maxBill: 10000,
  defaultBill: 600,

  steps: [
    {
      title: "Simule e envie sua conta",
      text: "Veja quanto vai economizar, anexe a foto ou PDF da sua conta de luz e preencha seus dados (nome, CPF/CNPJ, WhatsApp e cidade).",
    },
    {
      title: "Analisamos sua conta",
      text: "Seus dados e a conta chegam direto no WhatsApp da nossa equipe, que confere a fatura e confirma seu desconto.",
    },
    {
      title: "Desconto todo mês",
      text: "Você recebe créditos de energia solar direto na conta da sua distribuidora. Nada muda na sua casa ou empresa.",
    },
  ],

  benefits: [
    "Cadastro e adesão gratuitos",
    "Sem obras e sem placas no telhado",
    "Sem fidelidade — cancele quando quiser",
    "Continua com a mesma distribuidora",
  ],

  faq: [
    {
      q: "Por que vocês pedem meu CPF ou CNPJ?",
      a: "Porque o desconto é vinculado ao titular da conta de luz. Com o CPF/CNPJ emitimos sua proposta e o termo de adesão, que chega por WhatsApp e e-mail para você assinar digitalmente. Seus dados são usados só para isso (LGPD).",
    },
    {
      q: "Preciso pagar alguma coisa?",
      a: "Não. O cadastro, a adesão e a mensalidade são gratuitos. Você só passa a pagar menos na sua conta de luz.",
    },
    {
      q: "Como funciona sem instalar placas?",
      a: "A energia é gerada em usinas solares parceiras e entregue na rede da sua distribuidora. Pela Lei Federal 14.300/2022, regulamentada pela ANEEL, essa energia vira créditos que abatem o valor da sua fatura.",
    },
    {
      q: "Isso é legal? Não é golpe?",
      a: "É a Geração Distribuída compartilhada, prevista na Lei Federal 14.300/2022 e regulamentada pela ANEEL. A Eletrodara é uma empresa registrada (CNPJ 61.326.080/0001-64), sediada no Parque Tecnológico TecnoUCS, em Caxias do Sul.",
    },
    {
      q: "Corro risco de ficar sem luz?",
      a: "Não. Você continua ligado na mesma distribuidora, pelos mesmos fios e com o mesmo medidor. Só muda o valor da fatura.",
    },
    {
      q: "Tem fidelidade ou multa?",
      a: "Não há fidelidade obrigatória. Você pode cancelar quando quiser.",
    },
    {
      q: "Quem pode participar?",
      a: "Residências e empresas com conta de luz média a partir de R$ 250 por mês, sendo o titular da unidade consumidora ou representante legal do imóvel.",
    },
  ],
};
