// Integração com o Sistema Eletrodara (app.eletrodara.com.br).
//
// O sistema não tem API pública: o formulário "cadastro completo" de cada parceiro chama
// Server Actions do Next.js. Aqui reproduzimos essas mesmas chamadas a partir do servidor.
// Os IDs das actions mudam a cada deploy deles, então são descobertos lendo o JavaScript
// público da página (createServerReference("<id>", ..., "<nomeDaFunção>")) e renovados
// automaticamente quando uma chamada falha.
const BASE_URL = process.env.ELETRODARA_URL || 'https://app.eletrodara.com.br';
const ORIGEM_LANDING = 'Landing'; // nome da origem no sistema deles
const TIPO_LEAD = 'Assinatura';
const ACTIONS = [
  'getDistribuidorasPublicadas',
  'getEstados',
  'getCidadesPorEstadoId',
  'getPublicNovoLeadFormData',
  'checkLeadDocumentoExistePublico',
  'getPresignedUploadUrlsForPublicCadastroCompleto',
  'createLeadFromPublicLinkCompleto',
];
const CACHE_MS = 6 * 60 * 60 * 1000;

const pageUrl = (slug) => `${BASE_URL}/cadastro-completo/${encodeURIComponent(slug)}`;

let actionIds = null; // { nome: id }
let actionIdsAt = 0;
const cache = new Map(); // chave -> { at, value }

async function discoverActionIds(slug) {
  const html = await (await fetch(pageUrl(slug), { headers: { 'User-Agent': 'Mozilla/5.0 (integracao landing)' } })).text();
  const chunks = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0]))];
  const found = {};
  await Promise.all(
    chunks.map(async (chunk) => {
      const js = await (await fetch(`${BASE_URL}${chunk}`)).text();
      for (const m of js.matchAll(/createServerReference\)\("([0-9a-f]{20,})",[^)]*?"(\w+)"\)/g)) {
        if (ACTIONS.includes(m[2])) found[m[2]] = m[1];
      }
    })
  );
  const missing = ACTIONS.filter((a) => !found[a]);
  if (missing.length) throw new Error(`Funções não encontradas no sistema Eletrodara: ${missing.join(', ')}`);
  actionIds = found;
  actionIdsAt = Date.now();
  return found;
}

async function getActionIds(slug, force = false) {
  if (force || !actionIds || Date.now() - actionIdsAt > CACHE_MS) await discoverActionIds(slug);
  return actionIds;
}

// Resposta RSC: linhas "0:{...}" e "1:<valor de retorno>".
function parseActionResponse(text) {
  const line = text.split('\n').find((l) => l.startsWith('1:'));
  if (!line) throw new Error(`Resposta inesperada do sistema Eletrodara: ${text.slice(0, 200)}`);
  return JSON.parse(line.slice(2));
}

// Chama uma Server Action. `args` só com valores JSON, ou [slug, FormData] (vira multipart).
async function callAction(slug, name, args, retry = true) {
  const ids = await getActionIds(slug);
  let body;
  const headers = { 'Next-Action': ids[name], Accept: 'text/x-component', 'User-Agent': 'Mozilla/5.0 (integracao landing)' };
  const formIndex = args.findIndex((a) => a instanceof FormData);
  if (formIndex >= 0) {
    // Mesmo formato do encodeReply do React: FormData vira "$K1" e seus campos ganham o prefixo "_1_".
    body = new FormData();
    const inner = args[formIndex];
    for (const [key, value] of inner.entries()) body.append(`_1_${key}`, value);
    body.append('0', JSON.stringify(args.map((a, i) => (i === formIndex ? '$K1' : a))));
  } else {
    body = JSON.stringify(args);
    headers['Content-Type'] = 'text/plain;charset=UTF-8';
  }

  const res = await fetch(pageUrl(slug), { method: 'POST', headers, body });
  const text = await res.text();
  if (!res.ok || !res.headers.get('content-type')?.includes('text/x-component')) {
    // Provável deploy novo do lado deles: redescobre os IDs e tenta uma vez mais.
    if (retry) {
      await getActionIds(slug, true);
      return callAction(slug, name, args, false);
    }
    throw new Error(`Sistema Eletrodara respondeu ${res.status} em ${name}: ${text.slice(0, 200)}`);
  }
  return parseActionResponse(text);
}

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const normalize = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// ---------------------------------------------------------------------------
// Consultas (somente leitura)
// ---------------------------------------------------------------------------

export const getDistribuidoras = (slug) => cached('distribuidoras', () => callAction(slug, 'getDistribuidorasPublicadas', []));
const getEstados = (slug) => cached('estados', () => callAction(slug, 'getEstados', []));
const getCidades = (slug, estadoId) => cached(`cidades-${estadoId}`, () => callAction(slug, 'getCidadesPorEstadoId', [estadoId]));
const getFormData = (slug) => cached('form-data', () => callAction(slug, 'getPublicNovoLeadFormData', []));

async function findDistribuidora(slug, { distribuidoraId, distributor }) {
  const list = await getDistribuidoras(slug);
  if (distribuidoraId) {
    const byId = list.find((d) => d.id === distribuidoraId);
    if (byId) return byId;
  }
  const wanted = normalize(distributor);
  return list.find((d) => normalize(d.alias) === wanted) || list.find((d) => wanted && normalize(d.nome).includes(wanted)) || null;
}

export async function findCidade(slug, uf, cidade) {
  const estados = await getEstados(slug);
  const estado = estados.find((e) => e.sigla === String(uf || '').toUpperCase());
  if (!estado) return { estado: null, cidade: null };
  const cidades = await getCidades(slug, estado.id);
  const wanted = normalize(cidade);
  return { estado, cidade: (Array.isArray(cidades) ? cidades : []).find((c) => normalize(c.nome) === wanted) || null };
}

// ---------------------------------------------------------------------------
// Envio do cadastro
// ---------------------------------------------------------------------------

const formatBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Cria o cadastro no Sistema Eletrodara pelo link público do parceiro (slug).
 * Retorna { status: 'enviado' | 'ja_existe', detail } ou lança erro.
 * @param {{ slug: string, lead: any, file?: { buffer: Buffer, name: string, type: string } | null, observacoes?: string }} p
 */
export async function sendLead({ slug, lead, file, observacoes }) {
  const documento = String(lead.documento || '');
  if (!documento) throw new Error('Cadastro sem CPF/CNPJ.');

  // Evita duplicar cliente que já existe no sistema deles.
  const existe = await callAction(slug, 'checkLeadDocumentoExistePublico', [slug, documento]);
  if (existe?.existe) return { status: 'ja_existe', detail: 'CPF/CNPJ já cadastrado no sistema Eletrodara.' };

  const [formData, distribuidora, local] = await Promise.all([
    getFormData(slug),
    findDistribuidora(slug, lead),
    findCidade(slug, lead.uf, lead.city),
  ]);
  if (!distribuidora) throw new Error(`Concessionária "${lead.distributor}" não encontrada no sistema Eletrodara.`);
  const origem = formData.origens?.find((o) => o.nome === ORIGEM_LANDING) || formData.origens?.find((o) => o.nome === 'Não definida');
  const tipoLead = formData.tiposLead?.find((t) => t.nome === TIPO_LEAD) || formData.tiposLead?.[0];

  const fd = new FormData();
  const set = (k, v) => fd.set(k, v == null ? '' : String(v));
  set('nome', lead.name);
  set('origem', origem?.id);
  set('tipoLeadId', tipoLead?.id);
  set('email', lead.email);
  set('documento', documento);
  set('responsavelLegalNome', '');
  set('responsavelLegalCpf', '');
  set('celular', lead.phone);
  set('aniversario', '');
  set('cep', '');
  set('endereco', '');
  set('numero', '');
  set('complemento', '');
  set('bairro', '');
  set('cidade', local.cidade?.nome || lead.city);
  set('uf', String(lead.uf || '').toUpperCase().slice(0, 2));
  if (local.estado) set('estadoId', local.estado.id);
  if (local.cidade) set('cidadeId', local.cidade.id);
  set('valor', lead.billValue ? formatBRL(lead.billValue) : '');
  set('observacoes', observacoes || '');
  set('isLeadUsina', '0');
  set('numeroUC', '');
  set('distribuidoraId', distribuidora.id);
  set('fase', '');
  set('consumoMensal', lead.kwhReal >= 100 ? lead.kwhReal : lead.kwhEstimated >= 100 ? lead.kwhEstimated : '');
  set('titularDiferente', '0');
  set('userAgent', 'Landing Eletrodara (integração automática)');

  if (file?.buffer) {
    const up = await callAction(slug, 'getPresignedUploadUrlsForPublicCadastroCompleto', [
      slug,
      [{ field: 'fatura', fileName: file.name, contentType: file.type || 'application/octet-stream' }],
    ]);
    const target = up?.ok ? up.urls?.fatura : null;
    if (target) {
      const put = await fetch(target.uploadUrl, { method: 'PUT', body: file.buffer, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      if (!put.ok) throw new Error(`Falha ao enviar a fatura (${put.status}).`);
      set('faturaPath', target.storagePath);
    } else {
      // Mesmo fallback do formulário deles: arquivo direto no envio.
      fd.set('fatura', new Blob([file.buffer], { type: file.type }), file.name);
    }
  }

  const result = await callAction(slug, 'createLeadFromPublicLinkCompleto', [slug, fd]);
  if (!result?.ok) throw new Error(result?.error || 'O sistema Eletrodara recusou o cadastro.');
  return { status: 'enviado', detail: result.leadId ? `Lead ${result.leadId}` : 'Cadastro criado.' };
}
