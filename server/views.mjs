// HTML do painel (renderizado no servidor, sem JavaScript obrigatório).
import { STATUSES } from './store.mjs';

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ELETRODARA_LINK_BASE = 'https://app.eletrodara.com.br/cadastro-completo/';

const brl = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const num = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const formatSize = (b) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const formatDate = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label ?? id;
const formatPhone = (digits) => {
  const d = String(digits || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
};

const CSS = `
:root{--brand:#008F3F;--brand-dark:#00702F;--brand-light:#E9F6EE;--sun:#FFF7DB;--sun-text:#8A5A00;--ink:#0F1A14;--muted:#64748b;--line:#e2e8f0;--bg:#f8fafc}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:#334155;font-size:15px}
a{color:var(--brand-dark)}
header{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10}
.bar{max-width:1100px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.bar img{height:30px;display:block}.who{font-size:13px;color:var(--muted);text-align:right}
nav{max-width:1100px;margin:0 auto;padding:0 12px;display:flex;gap:4px;overflow-x:auto}
nav a{padding:10px 12px;text-decoration:none;color:var(--muted);font-weight:600;font-size:14px;border-bottom:2px solid transparent;white-space:nowrap}
nav a.on{color:var(--brand-dark);border-color:var(--brand)}
main{max-width:1100px;margin:0 auto;padding:16px}
h1{font-size:22px;color:var(--ink);margin:4px 0 12px}h2{font-size:17px;color:var(--ink);margin:24px 0 10px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}
.kpi{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.kpi b{display:block;font-size:24px;color:var(--ink);line-height:1.2}.kpi span{font-size:13px;color:var(--muted)}
.kpi.hl{background:var(--brand-light);border-color:#bfe3cc}.kpi.hl b{color:var(--brand-dark)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px}
.chip{display:inline-flex;gap:6px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:999px;padding:5px 11px;font-size:13px;text-decoration:none;color:#334155}
.chip b{color:var(--ink)}.chip.on{background:var(--brand);border-color:var(--brand);color:#fff}.chip.on b{color:#fff}
.filters{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;margin:12px 0}
.filters label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted);flex:1 1 140px}
input,select,textarea{font:inherit;font-size:15px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;background:#fff;color:var(--ink);width:100%}
input:focus,select:focus,textarea:focus{outline:2px solid #bfe3cc;border-color:var(--brand)}
textarea{min-height:42px;resize:vertical}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--line);background:#fff;color:#334155;border-radius:10px;padding:8px 12px;font-size:14px;font-weight:600;text-decoration:none;cursor:pointer;white-space:nowrap}
.btn.primary{background:var(--brand);border-color:var(--brand);color:#fff}.btn.wa{background:#25D366;border-color:#25D366;color:#fff}
.btn.danger{color:#b91c1c;border-color:#fecaca}.btn.small{padding:6px 10px;font-size:13px}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:10px}
.row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;align-items:baseline}
.name{font-weight:700;color:var(--ink);font-size:16px}.muted{color:var(--muted);font-size:13px}
.meta{font-size:14px;margin:6px 0 10px;line-height:1.7}.meta span{margin-right:12px;white-space:nowrap}
.badge{display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:2px 9px;background:#f1f5f9;color:#334155}
.badge.novo{background:#e0f2fe;color:#075985}.badge.atendimento{background:var(--sun);color:var(--sun-text)}.badge.analisada{background:#ede9fe;color:#5b21b6}
.badge.ativado{background:var(--brand-light);color:var(--brand-dark)}.badge.perdido{background:#fee2e2;color:#991b1b}
.edit{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.edit .full{grid-column:1/-1}
.edit label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted)}
.actions{display:flex;flex-wrap:wrap;gap:8px}form.inline{display:inline}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:14px}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--line)}th{font-size:12px;color:var(--muted);font-weight:600;background:#f8fafc}
td.n,th.n{text-align:right;white-space:nowrap}.table-wrap{overflow-x:auto;border-radius:14px}
.flash{background:var(--brand-light);border:1px solid #bfe3cc;color:var(--brand-dark);border-radius:12px;padding:10px 12px;margin-bottom:12px}
.flash.err{background:#fef2f2;border-color:#fecaca;color:#991b1b}
.link{font-family:ui-monospace,Consolas,monospace;font-size:13px;background:#f1f5f9;border-radius:8px;padding:6px 8px;word-break:break-all;display:block;margin:6px 0}
.empty{text-align:center;color:var(--muted);padding:40px 0}
.login{max-width:360px;margin:48px auto;background:#fff;border:1px solid var(--line);border-radius:16px;padding:24px}
.login img{height:36px;display:block;margin:0 auto 18px}.login label{display:block;font-size:13px;color:var(--muted);margin:12px 0 4px}
.login .btn{width:100%;margin-top:16px;padding:12px}
@media (max-width:560px){.edit{grid-template-columns:1fr}.kpi b{font-size:21px}}
`;

const shell = (title, body) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><link rel="icon" href="/favicon.png"><style>${CSS}</style></head>
<body>${body}</body></html>`;

function layout(user, active, title, content) {
  const tabs = [
    ['visao', '/painel', 'Visão geral'],
    ...(user.role === 'admin'
      ? [
          ['parceiros', '/painel/parceiros', 'Parceiros'],
          ['config', '/painel/config', 'Configurações'],
        ]
      : [['meu-link', '/painel/meu-link', 'Meu link']]),
  ];
  return shell(
    `${title} — Painel Eletrodara`,
    `<header>
  <div class="bar"><img src="/logo.png" alt="Eletrodara">
    <div class="who">${escapeHtml(user.name)}<br><a href="/painel/sair">Sair</a></div></div>
  <nav>${tabs.map(([id, href, label]) => `<a href="${href}" class="${id === active ? 'on' : ''}">${label}</a>`).join('')}</nav>
</header>
<main>${content}</main>`
  );
}

// Situação do envio ao Sistema Eletrodara (só o admin vê).
function eletrodaraLine(l) {
  const e = l.eletrodara;
  if (!e) return '<div class="muted" style="margin-bottom:8px">Sistema Eletrodara: não enviado</div>';
  const label = { enviado: '✅ Enviado ao Sistema Eletrodara', ja_existe: '☑️ Já existia no Sistema Eletrodara', erro: '⚠️ Falha ao enviar ao Sistema Eletrodara' }[e.status] || e.status;
  return `<div class="${e.status === 'erro' ? 'flash err' : 'muted'}" style="margin-bottom:8px;font-size:13px">${label} · ${formatDate(e.at)}${e.detail ? ` — ${escapeHtml(e.detail)}` : ''}</div>`;
}

const flashBox = (flash) => (flash ? `<div class="flash ${flash.type === 'err' ? 'err' : ''}">${escapeHtml(flash.text)}</div>` : '');

// ---------------------------------------------------------------------------

export function loginPage(error) {
  return shell(
    'Entrar — Painel Eletrodara',
    `<form class="login" method="post" action="/painel/login">
  <img src="/logo.png" alt="Eletrodara">
  ${error ? `<div class="flash err">${escapeHtml(error)}</div>` : ''}
  <label for="u">Usuário</label><input id="u" name="username" autocomplete="username" autocapitalize="none" required>
  <label for="p">Senha</label><input id="p" name="password" type="password" autocomplete="current-password" required>
  <button class="btn primary">Entrar</button>
</form>`
  );
}

export function messagePage(text) {
  return shell('Eletrodara', `<header><div class="bar"><img src="/logo.png" alt="Eletrodara"></div></header><main><p class="empty">${escapeHtml(text)}</p></main>`);
}

// ---------------------------------------------------------------------------

export function dashboardPage({ user, leads, allPartners, stats, ranking, query, flash, origin, storage }) {
  const isAdmin = user.role === 'admin';
  const partnerName = (id) => allPartners.find((p) => p.id === id)?.name ?? 'Eletrodara (direto)';
  const filterLink = (changes) => {
    const params = new URLSearchParams({ ...query, ...changes });
    for (const [k, v] of [...params]) if (!v) params.delete(k);
    const s = params.toString();
    return `/painel${s ? `?${s}` : ''}`;
  };

  const kpis = `<div class="kpis">
  <div class="kpi"><b>${num(stats.total)}</b><span>cadastros</span></div>
  <div class="kpi hl"><b>${num(stats.kwhTotal)}</b><span>kWh/mês cadastrados<br>${num(stats.kwhConfirmed)} confirmados na fatura</span></div>
  <div class="kpi"><b>${num(stats.byStatus.ativado || 0)}</b><span>ativados · ${num(stats.kwhActive)} kWh/mês</span></div>
  <div class="kpi"><b>${brl(stats.billTotal)}</b><span>em contas de luz/mês</span></div>
  ${isAdmin ? `<div class="kpi"><b>${formatSize(storage.bytes)}</b><span>${storage.files} contas guardadas</span></div>` : ''}
</div>`;

  const funnel = `<div class="chips">
  <a class="chip ${!query.status ? 'on' : ''}" href="${filterLink({ status: '' })}">Todos <b>${num(stats.total)}</b></a>
  ${STATUSES.map((s) => `<a class="chip ${query.status === s.id ? 'on' : ''}" href="${filterLink({ status: s.id })}">${s.label} <b>${num(stats.byStatus[s.id] || 0)}</b></a>`).join('')}
</div>`;

  const periodOptions = [
    ['', 'Todo o período'],
    ['hoje', 'Hoje'],
    ['7d', 'Últimos 7 dias'],
    ['30d', 'Últimos 30 dias'],
    ['mes', 'Este mês'],
  ];
  const filterForm = `<form class="filters" method="get" action="/painel">
  <label>Buscar<input name="q" value="${escapeHtml(query.q || '')}" placeholder="Nome, telefone ou cidade"></label>
  <label>Período<select name="periodo">${periodOptions.map(([v, l]) => `<option value="${v}" ${query.periodo === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  ${
    isAdmin
      ? `<label>Parceiro<select name="parceiro"><option value="">Todos</option><option value="direto" ${query.parceiro === 'direto' ? 'selected' : ''}>Eletrodara (direto)</option>${allPartners
          .map((p) => `<option value="${p.id}" ${query.parceiro === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`)
          .join('')}</select></label>`
      : ''
  }
  ${query.status ? `<input type="hidden" name="status" value="${escapeHtml(query.status)}">` : ''}
  <button class="btn primary">Filtrar</button>
  <a class="btn" href="/painel/exportar.csv?${new URLSearchParams(query)}">Baixar planilha (CSV)</a>
</form>`;

  const rankingTable =
    isAdmin && ranking.length
      ? `<h2>Parceiros no período</h2><div class="table-wrap"><table>
<thead><tr><th>Parceiro</th><th class="n">Cadastros</th><th class="n">Ativados</th><th class="n">kWh/mês</th><th class="n">kWh ativado</th></tr></thead>
<tbody>${ranking
          .map(
            (r) =>
              `<tr><td><a href="${filterLink({ parceiro: r.id || 'direto' })}">${escapeHtml(r.name)}</a></td><td class="n">${num(r.total)}</td><td class="n">${num(r.active)}</td><td class="n">${num(r.kwh)}</td><td class="n">${num(r.kwhActive)}</td></tr>`
          )
          .join('')}</tbody></table></div>`
      : '';

  const cards = leads
    .map((l) => {
      const phoneDigits = l.phone.replace(/\D/g, '');
      const fileActions = !l.file
        ? '<span class="muted">Sem conta anexada</span>'
        : l.file.deletedAt
          ? '<span class="muted">Conta já removida</span>'
          : `<a class="btn primary small" href="${origin}/conta/${l.file.token}" target="_blank" rel="noopener">Ver conta (${formatSize(l.file.size)})</a>
             <form class="inline" method="post" action="/painel/lead/${l.id}/apagar-conta" onsubmit="return confirm('Apagar o arquivo da conta? O cadastro continua.')"><button class="btn danger small">Apagar conta</button></form>`;
      return `<div class="card" id="c-${l.id}">
  <div class="row"><span class="name">${escapeHtml(l.name)}</span><span class="badge ${l.status}">${statusLabel(l.status)}</span></div>
  <div class="muted">${formatDate(l.createdAt)}${isAdmin ? ` · ${escapeHtml(partnerName(l.partnerId))}` : ''}</div>
  <div class="meta">
    <span>📱 ${escapeHtml(l.phone)}</span>${l.documento ? `<span>🪪 ${escapeHtml(l.documento)}</span>` : ''}${l.email ? `<span>✉️ ${escapeHtml(l.email)}</span>` : ''}
    <span>📍 ${escapeHtml(l.city || '—')}${l.uf ? `/${escapeHtml(l.uf)}` : ''}</span><span>🏢 ${escapeHtml(l.distributor || '—')}</span>
    <span>💰 ${brl(l.billValue)}/mês</span><span>⚡ ${l.kwhReal != null ? `<b>${num(l.kwhReal)} kWh</b> (fatura)` : `~${num(l.kwhEstimated)} kWh (estimado)`}</span>
  </div>
  ${isAdmin ? eletrodaraLine(l) : ''}
  <form method="post" action="/painel/lead/${l.id}">
    <div class="edit">
      <label>Status<select name="status">${STATUSES.map((s) => `<option value="${s.id}" ${l.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
      <label>kWh/mês real (da fatura)<input name="kwhReal" type="number" min="0" step="1" inputmode="numeric" value="${l.kwhReal ?? ''}" placeholder="Estimado: ${num(l.kwhEstimated)}"></label>
      <label class="full">Anotações<textarea name="notes" rows="1" placeholder="Ex.: ligar sexta, pediu proposta empresa">${escapeHtml(l.notes)}</textarea></label>
    </div>
    <div class="actions">
      <button class="btn primary small">Salvar</button>
      <a class="btn wa small" href="https://wa.me/55${phoneDigits}" target="_blank" rel="noopener">Chamar no WhatsApp</a>
    </div>
  </form>
  <div class="actions" style="margin-top:8px">
    ${fileActions}
    ${
      isAdmin && l.eletrodara?.status !== 'enviado' && l.eletrodara?.status !== 'ja_existe'
        ? `<form class="inline" method="post" action="/painel/lead/${l.id}/enviar-eletrodara" onsubmit="return confirm('Enviar o cadastro de ${escapeHtml(l.name)} ao Sistema Eletrodara? Isso cria o lead lá e pode disparar o termo de assinatura.')"><button class="btn small">${l.eletrodara ? 'Reenviar' : 'Enviar'} ao Sistema Eletrodara</button></form>`
        : ''
    }
    ${isAdmin ? `<form class="inline" method="post" action="/painel/lead/${l.id}/excluir" onsubmit="return confirm('Excluir o cadastro de ${escapeHtml(l.name)} e a conta? Não dá para desfazer.')"><button class="btn danger small">Excluir cadastro</button></form>` : ''}
  </div>
</div>`;
    })
    .join('\n');

  return layout(
    user,
    'visao',
    'Visão geral',
    `${flashBox(flash)}<h1>${isAdmin ? 'Visão geral' : `Olá, ${escapeHtml(user.name.split(' ')[0])}`}</h1>
${kpis}${funnel}${filterForm}${rankingTable}
<h2>Clientes (${num(leads.length)})</h2>
${cards || '<p class="empty">Nenhum cadastro encontrado.</p>'}`
  );
}

// ---------------------------------------------------------------------------

export function partnersPage({ user, partners, statsByPartner, origin, flash }) {
  const rows = partners
    .map((p) => {
      const s = statsByPartner.get(p.id) || { total: 0, active: 0, kwh: 0 };
      const link = `${origin}/p/${p.slug}`;
      return `<div class="card">
  <div class="row"><span class="name">${escapeHtml(p.name)}</span><span class="badge ${p.active ? 'ativado' : 'perdido'}">${p.active ? 'Ativo' : 'Desativado'}</span></div>
  <div class="meta"><span>📱 ${escapeHtml(formatPhone(p.whatsapp))}</span><span>👤 usuário: <b>${escapeHtml(p.username)}</b></span>
    <span>${num(s.total)} cadastros</span><span>${num(s.active)} ativados</span><span>${num(s.kwh)} kWh/mês</span></div>
  <span class="muted">Link de divulgação:</span><span class="link">${escapeHtml(link)}</span>
  <span class="muted">Cadastro completo no Sistema Eletrodara: ${p.eletrodaraSlug ? `<b>${escapeHtml(p.eletrodaraSlug)}</b>` : 'usa o link padrão das Configurações'}</span>
  <div class="actions" style="margin-top:8px">
    <a class="btn wa small" href="https://wa.me/?text=${encodeURIComponent(`Seu link de cadastros Eletrodara: ${link}\nPainel: ${origin}/painel (usuário: ${p.username})`)}" target="_blank" rel="noopener">Enviar link</a>
    <a class="btn small" href="/painel?parceiro=${p.id}">Ver cadastros</a>
    <details><summary class="btn small">Editar</summary>
      <form method="post" action="/painel/parceiros/${p.id}" class="edit" style="margin-top:8px">
        <label>Nome<input name="name" value="${escapeHtml(p.name)}" required></label>
        <label>WhatsApp (com DDD)<input name="whatsapp" value="${escapeHtml(formatPhone(p.whatsapp))}" inputmode="tel" required></label>
        <label class="full">Link do cadastro completo no Sistema Eletrodara (opcional)<input name="eletrodaraLink" value="${p.eletrodaraSlug ? `${ELETRODARA_LINK_BASE}${escapeHtml(p.eletrodaraSlug)}` : ''}" placeholder="${ELETRODARA_LINK_BASE}nome-do-parceiro"></label>
        <label class="full">Nova senha (deixe em branco para manter)<input name="password" type="text" autocomplete="new-password"></label>
        <div class="actions full"><button class="btn primary small">Salvar</button></div>
      </form>
    </details>
    <form class="inline" method="post" action="/painel/parceiros/${p.id}/${p.active ? 'desativar' : 'ativar'}"><button class="btn small">${p.active ? 'Desativar' : 'Ativar'}</button></form>
    <form class="inline" method="post" action="/painel/parceiros/${p.id}/excluir" onsubmit="return confirm('Excluir o parceiro ${escapeHtml(p.name)}? Os cadastros dele continuam no painel como Eletrodara (direto).')"><button class="btn danger small">Excluir</button></form>
  </div>
</div>`;
    })
    .join('\n');

  return layout(
    user,
    'parceiros',
    'Parceiros',
    `${flashBox(flash)}<h1>Parceiros</h1>
<p class="muted">Cada parceiro recebe um link próprio. Quem se cadastra por esse link cai no WhatsApp dele, e ele vê só os próprios clientes no painel.</p>
<div class="card"><h2 style="margin-top:0">Novo parceiro</h2>
<form method="post" action="/painel/parceiros" class="edit">
  <label>Nome<input name="name" required placeholder="Ex.: João Silva"></label>
  <label>WhatsApp (com DDD)<input name="whatsapp" required inputmode="tel" placeholder="(54) 99999-9999"></label>
  <label>Usuário de acesso<input name="username" required autocapitalize="none" placeholder="Ex.: joao"></label>
  <label>Senha<input name="password" required type="text" autocomplete="new-password" minlength="6"></label>
  <label class="full">Link do cadastro completo no Sistema Eletrodara (opcional)<input name="eletrodaraLink" placeholder="${ELETRODARA_LINK_BASE}nome-do-parceiro"></label>
  <div class="actions full"><button class="btn primary">Cadastrar parceiro</button></div>
</form></div>
<h2>Parceiros cadastrados (${partners.length})</h2>
${rows || '<p class="empty">Nenhum parceiro ainda.</p>'}`
  );
}

export function myLinkPage({ user, origin }) {
  const link = `${origin}/p/${user.partner.slug}`;
  return layout(
    user,
    'meu-link',
    'Meu link',
    `<h1>Seu link de divulgação</h1>
<div class="card"><p>Compartilhe este link com seus clientes. Quem se cadastrar por ele cai direto no seu WhatsApp e aparece no seu painel.</p>
<span class="link">${escapeHtml(link)}</span>
<div class="actions"><a class="btn wa" href="https://wa.me/?text=${encodeURIComponent(`Economize de 20% a 25% na sua conta de luz, sem obras e sem placas. Faça sua simulação grátis: ${link}`)}" target="_blank" rel="noopener">Compartilhar no WhatsApp</a>
<a class="btn" href="${escapeHtml(link)}" target="_blank" rel="noopener">Abrir página</a></div></div>`
  );
}

export function settingsPage({ user, settings, flash }) {
  return layout(
    user,
    'config',
    'Configurações',
    `${flashBox(flash)}<h1>Configurações</h1>
<div class="card"><form method="post" action="/painel/config" class="edit">
  <h2 class="full" style="margin-top:0">Sistema Eletrodara</h2>
  <label class="full" style="flex-direction:row;align-items:center;gap:10px;font-size:15px;color:var(--ink)">
    <input type="checkbox" name="eletrodaraAuto" value="1" ${settings.eletrodaraAuto ? 'checked' : ''} style="width:20px;height:20px">
    Enviar cada cadastro novo automaticamente ao Sistema Eletrodara</label>
  <p class="muted full" style="margin:0">Cria o lead lá (origem "Landing") com CPF/CNPJ, contato, cidade, concessionária, valor e fatura — e o sistema deles pode disparar o termo de assinatura. Desligado, você envia cadastro por cadastro pelo botão "Enviar ao Sistema Eletrodara".</p>
  <label class="full">Link padrão do cadastro completo (clientes sem parceiro, ou parceiro sem link próprio)
    <input name="eletrodaraLink" value="${ELETRODARA_LINK_BASE}${escapeHtml(settings.eletrodaraSlugPadrao || '')}" required></label>
  <h2 class="full">Estimativa de kWh</h2>
  <label class="full">Tarifa média (R$ por kWh, com impostos) — usada para estimar o kWh pelo valor da conta
    <input name="tariffPerKwh" type="number" step="0.01" min="0.1" max="5" value="${settings.tariffPerKwh}" required></label>
  <p class="muted full" style="margin:0">Ao salvar, as estimativas de todos os cadastros sem kWh real são recalculadas.</p>
  <div class="actions full"><button class="btn primary">Salvar</button></div>
</form></div>`
  );
}
