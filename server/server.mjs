// Servidor da landing page: serve o site (dist/), recebe cadastros e expõe o painel com senha.
// Sem dependências externas — só módulos nativos do Node.
import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(process.env.DIST_DIR || path.join(ROOT, '..', 'dist'));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, '..', 'data'));
const LEADS_DIR = path.join(DATA_DIR, 'leads');
const FILES_DIR = path.join(DATA_DIR, 'files');
const PORT = Number(process.env.PORT || 3001);
const ADMIN_USER = process.env.ADMIN_USER || 'eletrodara';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const FILE_RETENTION_DAYS = Number(process.env.FILE_RETENTION_DAYS || 30);
const MAX_BODY_BYTES = 15 * 1024 * 1024; // conta de até ~10 MB em base64
const RATE_LIMIT_PER_HOUR = 20;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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

// ---------------------------------------------------------------------------
// Armazenamento: um JSON por cadastro em data/leads, arquivos em data/files.
// ---------------------------------------------------------------------------

/** @type {Map<string, any>} id -> cadastro */
const leads = new Map();

async function loadLeads() {
  await fs.mkdir(LEADS_DIR, { recursive: true });
  await fs.mkdir(FILES_DIR, { recursive: true });
  for (const name of await fs.readdir(LEADS_DIR)) {
    if (!name.endsWith('.json')) continue;
    try {
      const lead = JSON.parse(await fs.readFile(path.join(LEADS_DIR, name), 'utf8'));
      leads.set(lead.id, lead);
    } catch (err) {
      console.error('Cadastro ilegível:', name, err.message);
    }
  }
  console.log(`${leads.size} cadastros carregados de ${DATA_DIR}`);
}

const saveLead = (lead) => fs.writeFile(path.join(LEADS_DIR, `${lead.id}.json`), JSON.stringify(lead, null, 2));

async function removeFile(lead) {
  if (!lead.file) return;
  await fs.rm(path.join(FILES_DIR, lead.file.stored), { force: true });
  lead.file = { ...lead.file, deletedAt: new Date().toISOString() };
}

async function deleteLead(id) {
  const lead = leads.get(id);
  if (!lead) return false;
  if (lead.file && !lead.file.deletedAt) await removeFile(lead);
  await fs.rm(path.join(LEADS_DIR, `${id}.json`), { force: true });
  leads.delete(id);
  return true;
}

// Apaga automaticamente as contas (arquivos) mais antigas que FILE_RETENTION_DAYS.
async function cleanupOldFiles() {
  const limit = Date.now() - FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const lead of leads.values()) {
    if (lead.file && !lead.file.deletedAt && new Date(lead.createdAt).getTime() < limit) {
      await removeFile(lead);
      await saveLead(lead);
      console.log('Conta expirada removida:', lead.id);
    }
  }
}

function storageBytes() {
  let total = 0;
  for (const lead of leads.values()) if (lead.file && !lead.file.deletedAt) total += lead.file.size || 0;
  return total;
}

// ---------------------------------------------------------------------------
// Utilitários HTTP
// ---------------------------------------------------------------------------

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;

const publicOrigin = (req) => {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto.split(',')[0]}://${req.headers['x-forwarded-host'] || req.headers.host}`;
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}

const sendJson = (res, status, data) => send(res, status, JSON.stringify(data), { 'Content-Type': MIME['.json'] });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
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

const hits = new Map(); // ip -> timestamps
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT_PER_HOUR;
}

function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  const [user, ...rest] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
  const expected = Buffer.from(`${ADMIN_USER}:${ADMIN_PASSWORD}`);
  const given = Buffer.from(`${user}:${rest.join(':')}`);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

const askLogin = (res) =>
  send(res, 401, 'Acesso restrito.', { 'WWW-Authenticate': 'Basic realm="Painel Eletrodara", charset="UTF-8"', 'Content-Type': MIME['.txt'] });

// Bloqueia por 15 min o IP que errar a senha do painel 8 vezes, para dificultar adivinhação.
const LOGIN_MAX_FAILURES = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFailures = new Map(); // ip -> timestamps de erros

function loginBlocked(ip) {
  const now = Date.now();
  const recent = (loginFailures.get(ip) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
  loginFailures.set(ip, recent);
  return recent.length >= LOGIN_MAX_FAILURES;
}

const registerLoginFailure = (ip) => loginFailures.set(ip, [...(loginFailures.get(ip) || []), Date.now()]);

// Bloqueia POSTs do painel vindos de outros sites (CSRF), já que o navegador reenvia a senha sozinho.
const sameOrigin = (req) => {
  try {
    const { host } = new URL(req.headers.origin || req.headers.referer);
    return host === (req.headers['x-forwarded-host'] || req.headers.host);
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// Rotas
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
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

  const lead = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name: text(data.name),
    phone: text(data.phone, 20),
    city: text(data.city),
    distributor: text(data.distributor, 40),
    billValue: num(data.billValue),
    monthlySavingsMin: num(data.monthlySavingsMin),
    monthlySavings: num(data.monthlySavings),
    seller: text(data.seller, 20),
    source: text(data.source, 300),
    file: null,
  };

  if (lead.name.length < 3 || lead.phone.replace(/\D/g, '').length < 10) {
    return sendJson(res, 400, { ok: false, error: 'Nome e WhatsApp são obrigatórios.' });
  }

  let fileUrl = null;
  if (data.file?.data) {
    const ext = UPLOAD_EXT[data.file.type] || (/\.(pdf|jpe?g|png|webp|heic)$/i.exec(data.file.name || '')?.[0].toLowerCase() ?? null);
    if (!ext) return sendJson(res, 400, { ok: false, error: 'Formato de arquivo não aceito.' });
    const buffer = Buffer.from(data.file.data, 'base64');
    const token = crypto.randomBytes(18).toString('base64url');
    const stored = `${lead.id}${ext === '.jpeg' ? '.jpg' : ext}`;
    await fs.writeFile(path.join(FILES_DIR, stored), buffer);
    lead.file = { token, stored, originalName: text(data.file.name, 120), size: buffer.length };
    fileUrl = `${publicOrigin(req)}/conta/${token}`;
  }

  await saveLead(lead);
  leads.set(lead.id, lead);
  console.log('Novo cadastro:', lead.id, lead.city, lead.file ? `(conta ${Math.round(lead.file.size / 1024)} KB)` : '(sem conta)');
  sendJson(res, 201, { ok: true, fileUrl });
}

async function handleBillFile(req, res, token) {
  const lead = [...leads.values()].find((l) => l.file?.token === token);
  if (!lead || lead.file.deletedAt) {
    return send(res, 404, notFoundPage('Esta conta não está mais disponível. Ela pode ter sido removida ou expirado.'), { 'Content-Type': MIME['.html'] });
  }
  const filePath = path.join(FILES_DIR, lead.file.stored);
  const ext = path.extname(lead.file.stored);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Disposition': `inline; filename="conta-${encodeURIComponent(lead.name.split(' ')[0] || 'cliente')}${ext}"`,
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex',
  });
  createReadStream(filePath).on('error', () => res.end()).pipe(res);
}

async function handlePainel(req, res, url) {
  const ip = clientIp(req);
  if (loginBlocked(ip)) return send(res, 429, 'Muitas tentativas de senha. Tente de novo em 15 minutos.', { 'Content-Type': MIME['.txt'] });
  if (!isAdmin(req)) {
    // Primeiro acesso (sem senha digitada) não conta como erro.
    if (req.headers.authorization) registerLoginFailure(ip);
    return askLogin(res);
  }

  const deleteMatch = url.pathname.match(/^\/painel\/(excluir|apagar-conta)\/([\w-]+)$/);
  if (req.method === 'POST' && deleteMatch) {
    if (!sameOrigin(req)) return send(res, 403, 'Origem inválida.');
    const [, action, id] = deleteMatch;
    if (action === 'excluir') await deleteLead(id);
    else {
      const lead = leads.get(id);
      if (lead?.file && !lead.file.deletedAt) {
        await removeFile(lead);
        await saveLead(lead);
      }
    }
    return send(res, 303, '', { Location: '/painel' });
  }

  if (req.method !== 'GET' || url.pathname !== '/painel') return send(res, 404, 'Não encontrado.');
  send(res, 200, painelPage(req), { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
}

// ---------------------------------------------------------------------------
// Páginas HTML do painel
// ---------------------------------------------------------------------------

const brl = (v) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const formatSize = (b) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const formatDate = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

const pageShell = (title, body) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><link rel="icon" href="/favicon.png">
<style>
:root{--brand:#008F3F;--brand-dark:#00702F;--ink:#0F1A14;--muted:#64748b;--line:#e2e8f0;--bg:#f8fafc}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:#334155}
header{background:#fff;border-bottom:1px solid var(--line);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:0}
header img{height:34px}main{max-width:960px;margin:0 auto;padding:16px}
h1{font-size:22px;color:var(--ink);margin:8px 0 4px}.sub{color:var(--muted);font-size:14px;margin:0 0 16px}
.stats{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}.stat{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 14px;font-size:13px}.stat b{display:block;font-size:18px;color:var(--ink)}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:10px}
.row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 16px;align-items:baseline}
.name{font-weight:700;color:var(--ink);font-size:16px}.date{color:var(--muted);font-size:12px}
.meta{font-size:14px;margin:6px 0 10px;line-height:1.6}.meta span{white-space:nowrap;margin-right:12px}
.actions{display:flex;flex-wrap:wrap;gap:8px}form{margin:0}
.btn{display:inline-block;border:1px solid var(--line);background:#fff;color:#334155;border-radius:10px;padding:8px 12px;font-size:13px;font-weight:600;text-decoration:none;cursor:pointer}
.btn.primary{background:var(--brand);border-color:var(--brand);color:#fff}.btn.wa{background:#25D366;border-color:#25D366;color:#fff}
.btn.danger{color:#b91c1c;border-color:#fecaca}.btn.danger:hover{background:#fef2f2}
.tag{font-size:12px;color:var(--muted)}.empty{text-align:center;color:var(--muted);padding:48px 0}
</style></head><body>${body}</body></html>`;

function painelPage(req) {
  const list = [...leads.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const withFile = list.filter((l) => l.file && !l.file.deletedAt).length;
  const origin = publicOrigin(req);

  const cards = list
    .map((l) => {
      const phoneDigits = l.phone.replace(/\D/g, '');
      const waClient = `https://wa.me/55${phoneDigits}`;
      let fileBlock = '<span class="tag">Sem conta anexada</span>';
      if (l.file?.deletedAt) fileBlock = '<span class="tag">Conta já removida</span>';
      else if (l.file) {
        fileBlock = `<a class="btn primary" href="${origin}/conta/${l.file.token}" target="_blank" rel="noopener">Ver conta (${formatSize(l.file.size)})</a>
        <form method="post" action="/painel/apagar-conta/${l.id}" onsubmit="return confirm('Apagar só o arquivo da conta de ${escapeHtml(l.name)}? O cadastro continua na lista.')"><button class="btn danger">Apagar conta</button></form>`;
      }
      return `<div class="card">
  <div class="row"><span class="name">${escapeHtml(l.name)}</span><span class="date">${formatDate(l.createdAt)}</span></div>
  <div class="meta">
    <span>📱 ${escapeHtml(l.phone)}</span><span>📍 ${escapeHtml(l.city || '—')}</span><span>🏢 ${escapeHtml(l.distributor || '—')}</span>
    <span>💰 Conta ${brl(l.billValue)}</span><span>📉 ${brl(l.monthlySavingsMin)} a ${brl(l.monthlySavings)}/mês</span>
    ${l.seller ? `<span>🧑‍💼 Vendedor ${escapeHtml(l.seller)}</span>` : ''}
  </div>
  <div class="actions">
    <a class="btn wa" href="${waClient}" target="_blank" rel="noopener">Chamar no WhatsApp</a>
    ${fileBlock}
    <form method="post" action="/painel/excluir/${l.id}" onsubmit="return confirm('Excluir o cadastro de ${escapeHtml(l.name)} e a conta dele? Não dá para desfazer.')"><button class="btn danger">Excluir cadastro</button></form>
  </div>
</div>`;
    })
    .join('\n');

  return pageShell(
    'Painel de cadastros — Eletrodara',
    `<header><img src="/logo.png" alt="Eletrodara"><a class="btn" href="/painel">Atualizar</a></header>
<main>
  <h1>Cadastros</h1>
  <p class="sub">Contas de luz são apagadas automaticamente ${FILE_RETENTION_DAYS} dias após o cadastro.</p>
  <div class="stats">
    <div class="stat"><b>${list.length}</b>cadastros</div>
    <div class="stat"><b>${withFile}</b>contas guardadas</div>
    <div class="stat"><b>${formatSize(storageBytes())}</b>espaço usado</div>
  </div>
  ${cards || '<p class="empty">Nenhum cadastro ainda.</p>'}
</main>`
  );
}

const notFoundPage = (msg) =>
  pageShell('Não encontrado — Eletrodara', `<header><img src="/logo.png" alt="Eletrodara"></header><main><p class="empty">${escapeHtml(msg)}</p></main>`);

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
    const conta = url.pathname.match(/^\/conta\/([\w-]{10,})$/);
    if (conta) return await handleBillFile(req, res, conta[1]);
    if (url.pathname === '/painel' || url.pathname.startsWith('/painel/')) return await handlePainel(req, res, url);
    if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(req, res, url);
    send(res, 405, 'Método não permitido.');
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'Erro interno.' });
    else res.end();
  }
});

await loadLeads();
await cleanupOldFiles();
setInterval(() => cleanupOldFiles().catch(console.error), 6 * 60 * 60 * 1000);
if (!ADMIN_PASSWORD) console.warn('ADMIN_PASSWORD não definido — painel desativado.');
server.listen(PORT, () => console.log(`Servidor ouvindo na porta ${PORT}`));
