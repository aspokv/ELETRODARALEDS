// Servidor da landing page: serve o site (dist/), recebe cadastros e expõe o painel
// de administração (admin + parceiros). Sem dependências externas — só módulos nativos do Node.
import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createStore, STATUSES, STATUS_IDS } from './store.mjs';
import { createAuth } from './auth.mjs';
import * as views from './views.mjs';
import * as eletrodara from './eletrodara.mjs';
import { isDocumentoValido, formatDocumento } from './documento.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(process.env.DIST_DIR || path.join(ROOT, '..', 'dist'));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, '..', 'data'));
const PORT = Number(process.env.PORT || 3001);
const ADMIN_USER = process.env.ADMIN_USER || 'eletrodara';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const FILE_RETENTION_DAYS = Number(process.env.FILE_RETENTION_DAYS || 30);
const MAX_BODY_BYTES = 15 * 1024 * 1024; // conta de até ~10 MB em base64
const RATE_LIMIT_PER_HOUR = 20;
const TZ_OFFSET_MS = -3 * 60 * 60 * 1000; // America/Sao_Paulo (sem horário de verão)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};
const UPLOAD_EXT = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic' };

const store = createStore(DATA_DIR);
await store.load();
const auth = await createAuth({ dataDir: DATA_DIR, adminUser: ADMIN_USER, adminPassword: ADMIN_PASSWORD, store });

// ---------------------------------------------------------------------------
// Utilitários HTTP
// ---------------------------------------------------------------------------

const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;

const publicOrigin = (req) => {
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}
const sendJson = (res, status, data) => send(res, status, JSON.stringify(data), { 'Content-Type': MIME['.json'] });
const sendHtml = (res, status, html, headers = {}) =>
  send(res, status, html, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...headers });
const redirect = (res, location, headers = {}) => send(res, 303, '', { Location: location, ...headers });

function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Arquivo grande demais'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const readForm = async (req) => Object.fromEntries(new URLSearchParams(await readBody(req, 64 * 1024)));

const hits = new Map(); // ip -> timestamps de cadastros
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT_PER_HOUR;
}

// Bloqueia POSTs do painel vindos de outros sites (CSRF).
const sameOrigin = (req) => {
  try {
    const { host } = new URL(req.headers.origin || req.headers.referer);
    return host === (req.headers['x-forwarded-host'] || req.headers.host);
  } catch {
    return false;
  }
};

// Aceita o link completo (https://app.eletrodara.com.br/cadastro-completo/<slug>) ou só o <slug>.
const parseEletrodaraSlug = (v) => {
  const s = String(v ?? '').trim();
  const fromUrl = s.match(/cadastro-completo\/([\w-]+)/)?.[1];
  return (fromUrl || (/^[\w-]+$/.test(s) ? s : '')).slice(0, 60);
};

const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');
// Aceita "(54) 99999-9999", "54999999999" ou "5554999999999" e guarda com 55 na frente.
const normalizeWhatsapp = (v) => {
  const d = onlyDigits(v);
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
};

// ---------------------------------------------------------------------------
// API pública (site)
// ---------------------------------------------------------------------------

async function handleCreateLead(req, res) {
  if (rateLimited(clientIp(req))) return sendJson(res, 429, { ok: false, error: 'Muitas tentativas. Tente mais tarde.' });

  let data;
  try {
    data = JSON.parse(await readBody(req));
  } catch (err) {
    return sendJson(res, err.status || 400, { ok: false, error: err.message });
  }

  const text = (v, max = 120) => String(v ?? '').trim().slice(0, max);
  const num = (v) => (v !== '' && v != null && Number.isFinite(Number(v)) ? Number(v) : null);
  const partner = data.partner ? store.findPartnerBySlug(text(data.partner, 60)) : null;
  const billValue = num(data.billValue);

  const lead = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name: text(data.name),
    phone: text(data.phone, 20),
    documento: formatDocumento(data.documento),
    email: text(data.email, 120).toLowerCase(),
    city: text(data.city),
    uf: text(data.uf, 2).toUpperCase(),
    distributor: text(data.distributor, 80),
    distribuidoraId: text(data.distribuidoraId, 40),
    billValue,
    monthlySavingsMin: num(data.monthlySavingsMin),
    monthlySavings: num(data.monthlySavings),
    kwhEstimated: billValue ? Math.round(billValue / store.settings.tariffPerKwh) : null,
    kwhReal: null,
    partnerId: partner?.active ? partner.id : null,
    status: 'novo',
    history: [],
    notes: '',
    source: text(data.source, 300),
    file: null,
  };

  if (lead.name.length < 3 || onlyDigits(lead.phone).length < 10) {
    return sendJson(res, 400, { ok: false, error: 'Nome e WhatsApp são obrigatórios.' });
  }
  if (!isDocumentoValido(lead.documento)) return sendJson(res, 400, { ok: false, error: 'CPF ou CNPJ inválido.' });
  // E-mail obrigatório: o Sistema Eletrodara envia o termo de assinatura por e-mail e WhatsApp.
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(lead.email)) return sendJson(res, 400, { ok: false, error: 'Informe um e-mail válido.' });

  let buffer = null;
  let ext = null;
  if (data.file?.data) {
    ext = UPLOAD_EXT[data.file.type] || /\.(pdf|jpe?g|png|webp|heic)$/i.exec(data.file.name || '')?.[0].toLowerCase().replace('.jpeg', '.jpg');
    if (!ext) return sendJson(res, 400, { ok: false, error: 'Formato de arquivo não aceito.' });
    buffer = Buffer.from(data.file.data, 'base64');
    lead.file = { token: crypto.randomBytes(18).toString('base64url'), originalName: text(data.file.name, 120) };
  }

  await store.addLead(lead, buffer, ext);
  console.log('Novo cadastro:', lead.id, lead.city, partner ? `parceiro ${partner.slug}` : 'direto', buffer ? `(conta ${Math.round(buffer.length / 1024)} KB)` : '');
  sendJson(res, 201, { ok: true, fileUrl: lead.file ? `${publicOrigin(req)}/conta/${lead.file.token}` : null });

  // Envio ao Sistema Eletrodara em segundo plano: o cliente não espera por ele.
  if (store.settings.eletrodaraAuto) pushToEletrodara(lead, publicOrigin(req)).catch((err) => console.error('Eletrodara:', err));
}

// Envia um cadastro ao Sistema Eletrodara e registra o resultado no próprio cadastro.
async function pushToEletrodara(lead, origin) {
  const partner = lead.partnerId ? store.partners.get(lead.partnerId) : null;
  const slug = partner?.eletrodaraSlug || store.settings.eletrodaraSlugPadrao;
  const record = (status, detail) => store.updateLead(lead.id, { eletrodara: { status, detail, at: new Date().toISOString(), slug } }, 'sistema');

  if (!slug) return record('erro', 'Nenhum link do Sistema Eletrodara configurado.');
  if (!lead.documento) return record('erro', 'Cadastro sem CPF/CNPJ (feito antes da integração).');

  let file = null;
  if (lead.file && !lead.file.deletedAt) {
    const ext = path.extname(lead.file.stored);
    file = { buffer: await fs.readFile(store.filePath(lead)), name: `fatura-${lead.id.slice(0, 8)}${ext}`, type: MIME[ext] || 'application/octet-stream' };
  }
  const observacoes = [
    'Cadastro recebido pela landing page.',
    partner ? `Parceiro: ${partner.name}.` : null,
    lead.monthlySavings ? `Economia simulada: R$ ${Math.round(lead.monthlySavingsMin)} a R$ ${Math.round(lead.monthlySavings)}/mês.` : null,
    lead.file && !lead.file.deletedAt ? `Fatura: ${origin}/conta/${lead.file.token}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  try {
    const result = await eletrodara.sendLead({ slug, lead, file, observacoes });
    console.log('Eletrodara:', lead.id, result.status);
    return record(result.status, result.detail);
  } catch (err) {
    console.error('Eletrodara falhou:', lead.id, err.message);
    return record('erro', err.message.slice(0, 300));
  }
}

// Lista de concessionárias do Sistema Eletrodara para o formulário (com fallback local).
const FALLBACK_DISTRIBUIDORAS = ['RGE', 'CEEE Equatorial', 'Celesc', 'Copel', 'CPFL Paulista', 'CPFL Piratininga', 'Outra'].map((n) => ({ id: '', nome: n, plano: null }));
async function handleDistribuidoras(res) {
  try {
    const list = await eletrodara.getDistribuidoras(store.settings.eletrodaraSlugPadrao);
    const items = list
      .map((d) => ({ id: d.id, nome: d.nome.split(/ - | \(/)[0].trim(), alias: d.alias, plano: d.planoNome }))
      .sort((a, b) => (a.alias === 'RGE' ? -1 : b.alias === 'RGE' ? 1 : a.alias === 'CEQ' ? -1 : b.alias === 'CEQ' ? 1 : a.nome.localeCompare(b.nome)));
    sendJson(res, 200, { ok: true, items });
  } catch (err) {
    console.error('Distribuidoras indisponíveis:', err.message);
    sendJson(res, 200, { ok: true, items: FALLBACK_DISTRIBUIDORAS, fallback: true });
  }
}

function handlePartnerInfo(res, slug) {
  const partner = store.findPartnerBySlug(slug);
  if (!partner?.active) return sendJson(res, 404, { ok: false });
  sendJson(res, 200, { ok: true, slug: partner.slug, name: partner.name, whatsapp: partner.whatsapp });
}

function handleBillFile(req, res, token) {
  const lead = store.findLeadByFileToken(token);
  if (!lead || lead.file.deletedAt) {
    return sendHtml(res, 404, views.messagePage('Esta conta não está mais disponível. Ela pode ter sido removida ou expirado.'));
  }
  const ext = path.extname(lead.file.stored);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Disposition': `inline; filename="conta-${encodeURIComponent(lead.name.split(' ')[0] || 'cliente')}${ext}"`,
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex',
  });
  createReadStream(store.filePath(lead)).on('error', () => res.end()).pipe(res);
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

const FLASH = {
  salvo: ['ok', 'Alterações salvas.'],
  excluido: ['ok', 'Cadastro excluído.'],
  conta: ['ok', 'Arquivo da conta apagado.'],
  parceiro: ['ok', 'Parceiro cadastrado. Copie o link e envie para ele.'],
  'parceiro-salvo': ['ok', 'Parceiro atualizado.'],
  'parceiro-excluido': ['ok', 'Parceiro excluído.'],
  'erro-whats': ['err', 'WhatsApp inválido. Use DDD + número, ex.: (54) 99999-9999.'],
  'erro-usuario': ['err', 'Esse usuário já existe. Escolha outro.'],
  'erro-campos': ['err', 'Preencha todos os campos (senha com pelo menos 6 caracteres).'],
  'eletrodara-ok': ['ok', 'Cadastro enviado ao Sistema Eletrodara.'],
  'eletrodara-existe': ['ok', 'Esse CPF/CNPJ já existe no Sistema Eletrodara — nada foi duplicado.'],
  'eletrodara-erro': ['err', 'Não foi possível enviar ao Sistema Eletrodara. Veja o motivo no cadastro.'],
};
const flashFrom = (url) => {
  const f = FLASH[url.searchParams.get('msg')];
  return f ? { type: f[0], text: f[1] } : null;
};

// Cadastros que o usuário pode ver.
const visibleLeads = (user) => {
  const all = [...store.leads.values()];
  return user.role === 'admin' ? all : all.filter((l) => l.partnerId === user.partner.id);
};
const canEditLead = (user, lead) => lead && (user.role === 'admin' || lead.partnerId === user.partner.id);

function periodStart(periodo) {
  const nowLocal = new Date(Date.now() + TZ_OFFSET_MS);
  const startOfDay = Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate()) - TZ_OFFSET_MS;
  switch (periodo) {
    case 'hoje':
      return startOfDay;
    case '7d':
      return startOfDay - 6 * 86400000;
    case '30d':
      return startOfDay - 29 * 86400000;
    case 'mes':
      return Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), 1) - TZ_OFFSET_MS;
    default:
      return null;
  }
}

function applyFilters(leads, query, { ignoreStatus = false } = {}) {
  const since = periodStart(query.periodo);
  const q = (query.q || '').trim().toLowerCase();
  const qDigits = onlyDigits(q);
  return leads
    .filter((l) => !since || new Date(l.createdAt).getTime() >= since)
    .filter((l) => !query.parceiro || (query.parceiro === 'direto' ? !l.partnerId : l.partnerId === query.parceiro))
    .filter((l) => ignoreStatus || !query.status || l.status === query.status)
    .filter(
      (l) =>
        !q ||
        l.name.toLowerCase().includes(q) ||
        (l.city || '').toLowerCase().includes(q) ||
        (qDigits.length >= 4 && onlyDigits(l.phone).includes(qDigits))
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const leadKwh = (l) => l.kwhReal ?? l.kwhEstimated ?? 0;

function computeStats(leads) {
  const byStatus = {};
  let kwhTotal = 0;
  let kwhConfirmed = 0;
  let kwhActive = 0;
  let billTotal = 0;
  for (const l of leads) {
    byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    kwhTotal += leadKwh(l);
    if (l.kwhReal != null) kwhConfirmed += l.kwhReal;
    if (l.status === 'ativado') kwhActive += leadKwh(l);
    billTotal += l.billValue || 0;
  }
  return { total: leads.length, byStatus, kwhTotal, kwhConfirmed, kwhActive, billTotal };
}

function statsByPartner(leads) {
  const map = new Map();
  for (const l of leads) {
    const key = l.partnerId || null;
    const s = map.get(key) || { total: 0, active: 0, kwh: 0, kwhActive: 0 };
    s.total++;
    s.kwh += leadKwh(l);
    if (l.status === 'ativado') {
      s.active++;
      s.kwhActive += leadKwh(l);
    }
    map.set(key, s);
  }
  return map;
}

function storageInfo() {
  let bytes = 0;
  let files = 0;
  for (const l of store.leads.values()) {
    if (l.file && !l.file.deletedAt) {
      bytes += l.file.size || 0;
      files++;
    }
  }
  return { bytes, files };
}

function dashboard(req, res, url, user) {
  const query = Object.fromEntries(['q', 'periodo', 'parceiro', 'status'].map((k) => [k, url.searchParams.get(k) || '']).filter(([, v]) => v));
  if (user.role !== 'admin') delete query.parceiro;
  const base = visibleLeads(user);
  const forStats = applyFilters(base, query, { ignoreStatus: true });
  const leads = applyFilters(base, query);
  const partners = [...store.partners.values()].sort((a, b) => a.name.localeCompare(b.name));

  let ranking = [];
  if (user.role === 'admin') {
    ranking = [...statsByPartner(forStats)]
      .map(([id, s]) => ({ id, name: id ? store.partners.get(id)?.name ?? 'Parceiro removido' : 'Eletrodara (direto)', ...s }))
      .sort((a, b) => b.total - a.total);
  }

  sendHtml(
    res,
    200,
    views.dashboardPage({
      user,
      leads,
      allPartners: partners,
      stats: computeStats(forStats),
      ranking,
      query,
      flash: flashFrom(url),
      origin: publicOrigin(req),
      storage: storageInfo(),
    })
  );
}

function exportCsv(req, res, url, user) {
  const query = Object.fromEntries(['q', 'periodo', 'parceiro', 'status'].map((k) => [k, url.searchParams.get(k) || '']).filter(([, v]) => v));
  if (user.role !== 'admin') delete query.parceiro;
  const leads = applyFilters(visibleLeads(user), query);
  const origin = publicOrigin(req);
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label ?? id;
  const header = ['Data', 'Nome', 'WhatsApp', 'CPF/CNPJ', 'E-mail', 'Cidade', 'UF', 'Distribuidora', 'Conta (R$/mês)', 'kWh estimado', 'kWh real', 'Status', 'Parceiro', 'Anotações', 'Conta de luz', 'Sistema Eletrodara'];
  const lines = leads.map((l) =>
    [
      new Date(new Date(l.createdAt).getTime() + TZ_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' '),
      l.name,
      l.phone,
      l.documento,
      l.email,
      l.city,
      l.uf,
      l.distributor,
      l.billValue,
      l.kwhEstimated,
      l.kwhReal,
      statusLabel(l.status),
      l.partnerId ? store.partners.get(l.partnerId)?.name ?? '' : 'Eletrodara (direto)',
      l.notes,
      l.file && !l.file.deletedAt ? `${origin}/conta/${l.file.token}` : '',
      l.eletrodara ? [l.eletrodara.status, l.eletrodara.detail].filter(Boolean).join(': ') : '',
    ]
      .map(cell)
      .join(';')
  );
  // BOM + ponto e vírgula para o Excel em português abrir certo.
  const csv = '﻿' + [header.map(cell).join(';'), ...lines].join('\r\n');
  send(res, 200, csv, {
    'Content-Type': MIME['.csv'],
    'Content-Disposition': `attachment; filename="cadastros-eletrodara-${new Date().toISOString().slice(0, 10)}.csv"`,
    'Cache-Control': 'no-store',
  });
}

async function handlePainel(req, res, url) {
  const p = url.pathname.replace(/\/+$/, '') || '/painel';
  const ip = clientIp(req);

  // --- Login / logout
  if (p === '/painel/login') {
    if (req.method === 'GET') return sendHtml(res, 200, views.loginPage());
    if (auth.loginBlocked(ip)) return sendHtml(res, 429, views.loginPage('Muitas tentativas. Tente de novo em 15 minutos.'));
    const form = await readForm(req);
    const cookie = auth.login(ip, form.username, form.password);
    if (!cookie) return sendHtml(res, 401, views.loginPage('Usuário ou senha incorretos.'));
    return redirect(res, '/painel', { 'Set-Cookie': cookie });
  }
  if (p === '/painel/sair') return redirect(res, '/painel/login', { 'Set-Cookie': auth.clearCookie() });

  const user = auth.currentUser(req);
  if (!user) return redirect(res, '/painel/login');
  const isAdmin = user.role === 'admin';
  if (req.method === 'POST' && !sameOrigin(req)) return send(res, 403, 'Origem inválida.');

  // --- Visão geral e exportação
  if (p === '/painel' && req.method === 'GET') return dashboard(req, res, url, user);
  if (p === '/painel/exportar.csv') return exportCsv(req, res, url, user);
  if (p === '/painel/meu-link' && !isAdmin) return sendHtml(res, 200, views.myLinkPage({ user, origin: publicOrigin(req) }));

  // Volta para a mesma lista (com filtros) depois de salvar.
  const back = (msg, anchor = '') => {
    let target = '/painel';
    try {
      const ref = new URL(req.headers.referer);
      if (ref.pathname.startsWith('/painel')) {
        ref.searchParams.set('msg', msg);
        target = `${ref.pathname}${ref.search}`;
      }
    } catch {
      target = `/painel?msg=${msg}`;
    }
    return redirect(res, target + anchor);
  };

  // --- Cadastros
  const leadMatch = p.match(/^\/painel\/lead\/([\w-]+)(?:\/(apagar-conta|excluir|enviar-eletrodara))?$/);
  if (leadMatch && req.method === 'POST') {
    const [, id, action] = leadMatch;
    const lead = store.leads.get(id);
    if (!canEditLead(user, lead)) return send(res, 404, 'Não encontrado.');
    if (action === 'excluir') {
      if (!isAdmin) return send(res, 403, 'Só o administrador pode excluir cadastros.');
      await store.deleteLead(id);
      return back('excluido');
    }
    if (action === 'enviar-eletrodara') {
      if (!isAdmin) return send(res, 403, 'Só o administrador pode enviar ao Sistema Eletrodara.');
      await pushToEletrodara(lead, publicOrigin(req));
      const sent = store.leads.get(id)?.eletrodara?.status;
      return back(sent === 'enviado' ? 'eletrodara-ok' : sent === 'ja_existe' ? 'eletrodara-existe' : 'eletrodara-erro', `#c-${id}`);
    }
    if (action === 'apagar-conta') {
      await store.removeLeadFile(lead);
      return back('conta', `#c-${id}`);
    }
    const form = await readForm(req);
    const kwh = form.kwhReal === '' ? null : Math.max(0, Math.round(Number(form.kwhReal)));
    await store.updateLead(
      id,
      {
        status: STATUS_IDS.includes(form.status) ? form.status : lead.status,
        kwhReal: Number.isFinite(kwh) ? kwh : lead.kwhReal,
        notes: String(form.notes ?? '').slice(0, 1000),
      },
      user.name
    );
    return back('salvo', `#c-${id}`);
  }

  if (!isAdmin) return send(res, 403, 'Acesso restrito ao administrador.');

  // --- Parceiros (admin)
  if (p === '/painel/parceiros' && req.method === 'GET') {
    const partners = [...store.partners.values()].sort((a, b) => a.name.localeCompare(b.name));
    return sendHtml(
      res,
      200,
      views.partnersPage({ user, partners, statsByPartner: statsByPartner([...store.leads.values()]), origin: publicOrigin(req), flash: flashFrom(url) })
    );
  }
  if (p === '/painel/parceiros' && req.method === 'POST') {
    const form = await readForm(req);
    const name = String(form.name || '').trim().slice(0, 80);
    const username = String(form.username || '').trim().toLowerCase().slice(0, 40);
    const password = String(form.password || '');
    const whatsapp = normalizeWhatsapp(form.whatsapp);
    if (!name || !username || password.length < 6) return redirect(res, '/painel/parceiros?msg=erro-campos');
    if (!whatsapp) return redirect(res, '/painel/parceiros?msg=erro-whats');
    if (username === ADMIN_USER.toLowerCase() || store.findPartnerByUsername(username)) return redirect(res, '/painel/parceiros?msg=erro-usuario');
    await store.addPartner({ name, whatsapp, username, password, eletrodaraSlug: parseEletrodaraSlug(form.eletrodaraLink) });
    return redirect(res, '/painel/parceiros?msg=parceiro');
  }
  const partnerMatch = p.match(/^\/painel\/parceiros\/([\w-]+)(?:\/(ativar|desativar|excluir))?$/);
  if (partnerMatch && req.method === 'POST') {
    const [, id, action] = partnerMatch;
    if (!store.partners.has(id)) return send(res, 404, 'Não encontrado.');
    if (action === 'excluir') {
      await store.deletePartner(id);
      return redirect(res, '/painel/parceiros?msg=parceiro-excluido');
    }
    if (action) {
      await store.updatePartner(id, { active: action === 'ativar' });
      return redirect(res, '/painel/parceiros?msg=parceiro-salvo');
    }
    const form = await readForm(req);
    const whatsapp = normalizeWhatsapp(form.whatsapp);
    if (!whatsapp) return redirect(res, '/painel/parceiros?msg=erro-whats');
    if (form.password && form.password.length < 6) return redirect(res, '/painel/parceiros?msg=erro-campos');
    await store.updatePartner(id, {
      name: String(form.name || '').trim().slice(0, 80),
      whatsapp,
      password: form.password || undefined,
      eletrodaraSlug: parseEletrodaraSlug(form.eletrodaraLink),
    });
    return redirect(res, '/painel/parceiros?msg=parceiro-salvo');
  }

  // --- Configurações (admin)
  if (p === '/painel/config' && req.method === 'GET') {
    return sendHtml(res, 200, views.settingsPage({ user, settings: store.settings, flash: flashFrom(url) }));
  }
  if (p === '/painel/config' && req.method === 'POST') {
    const form = await readForm(req);
    await store.updateSettings({
      eletrodaraAuto: form.eletrodaraAuto === '1',
      eletrodaraSlugPadrao: parseEletrodaraSlug(form.eletrodaraLink) || store.settings.eletrodaraSlugPadrao,
    });
    const tariff = Number(String(form.tariffPerKwh).replace(',', '.'));
    if (Number.isFinite(tariff) && tariff >= 0.1 && tariff <= 5) {
      await store.updateSettings({ tariffPerKwh: tariff });
      for (const lead of store.leads.values()) {
        if (lead.billValue) {
          lead.kwhEstimated = Math.round(lead.billValue / tariff);
          await store.updateLead(lead.id, {}, 'sistema');
        }
      }
    }
    return redirect(res, '/painel/config?msg=salvo');
  }

  send(res, 404, 'Não encontrado.');
}

// ---------------------------------------------------------------------------
// Arquivos estáticos (dist/) com gzip em memória e fallback para index.html
// ---------------------------------------------------------------------------

const gzipCache = new Map();

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  let filePath = path.normalize(path.join(DIST_DIR, rel));
  if (!filePath.startsWith(DIST_DIR) || !existsSync(filePath) || (await fs.stat(filePath)).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }
  const ext = path.extname(filePath);
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': filePath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  };

  const compressible = ['.html', '.js', '.css', '.svg', '.json'].includes(ext);
  if (compressible && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    let gz = gzipCache.get(filePath);
    if (!gz) {
      gz = zlib.gzipSync(await fs.readFile(filePath));
      gzipCache.set(filePath, gz);
    }
    return send(res, 200, req.method === 'HEAD' ? undefined : gz, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
  }
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  createReadStream(filePath).pipe(res);
}

// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/leads' && req.method === 'POST') return await handleCreateLead(req, res);
    if (url.pathname === '/api/health') return sendJson(res, 200, { ok: true });
    if (url.pathname === '/api/distribuidoras') return await handleDistribuidoras(res);
    const partnerApi = url.pathname.match(/^\/api\/parceiro\/([\w-]+)$/);
    if (partnerApi) return handlePartnerInfo(res, partnerApi[1]);
    const conta = url.pathname.match(/^\/conta\/([\w-]{10,})$/);
    if (conta) return handleBillFile(req, res, conta[1]);
    if (url.pathname === '/painel' || url.pathname.startsWith('/painel/')) return await handlePainel(req, res, url);
    if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(req, res, url);
    send(res, 405, 'Método não permitido.');
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'Erro interno.' });
    else res.end();
  }
});

await store.cleanupOldFiles(FILE_RETENTION_DAYS);
setInterval(() => store.cleanupOldFiles(FILE_RETENTION_DAYS).catch(console.error), 6 * 60 * 60 * 1000);
if (!ADMIN_PASSWORD) console.warn('ADMIN_PASSWORD não definido — login de administrador desativado.');
server.listen(PORT, () => console.log(`Servidor ouvindo na porta ${PORT}`));
