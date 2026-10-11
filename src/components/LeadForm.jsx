import React, { useRef, useState } from 'react';
import { SITE_CONFIG } from '../config/site';

const MAX_FILE_MB = 10;
const VALID_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];

const formatBRL = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatPhone = (value) => {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const readAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// Salva o cadastro (e a conta, se houver) no endpoint configurado.
// Retorna o link da conta salva, quando o endpoint devolve um.
// Usa text/plain para evitar o preflight de CORS, que o Google Apps Script não responde.
async function saveLead(lead, file) {
  if (!SITE_CONFIG.leadEndpoint) {
    console.warn('VITE_LEAD_ENDPOINT não configurado — cadastro não foi salvo.', lead);
    return null;
  }
  const payload = { ...lead };
  if (file) {
    payload.file = { name: file.name, type: file.type, data: await readAsBase64(file) };
  }
  const res = await fetch(SITE_CONFIG.leadEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return data.fileUrl || null;
}

const buildMessage = (lead, fileUrl, hasFile) => {
  let billLine;
  if (fileUrl) billLine = `📄 *Conta de luz:* ${fileUrl}`;
  else if (hasFile) billLine = '📄 *Conta de luz:* vou anexar aqui no chat';
  else billLine = '📸 *Conta de luz:* vou enviar a foto aqui no chat';

  return `⚡ *CADASTRO - DESCONTO NA CONTA DE LUZ* ⚡
-----------------------------------------
👤 *Nome:* ${lead.name}
📱 *WhatsApp:* ${lead.phone}
📍 *Cidade:* ${lead.city}
🏢 *Distribuidora:* ${lead.distributor}
💰 *Conta média:* ${formatBRL(lead.billValue)}
📉 *Economia estimada:* ${formatBRL(lead.monthlySavings)}/mês (${formatBRL(lead.annualSavings)}/ano)
${billLine}
-----------------------------------------
Olá! Fiz a simulação no site e quero ativar meu desconto.`;
};

const inputClass =
  'w-full bg-white/[0.04] border border-white/15 rounded-xl px-4 py-3.5 text-white text-base placeholder:text-slate-500 focus:border-emerald-400 focus:bg-white/[0.06] outline-none transition-colors';

export function LeadForm() {
  const fileInputRef = useRef(null);
  const [billValue, setBillValue] = useState(SITE_CONFIG.defaultBill);
  const [form, setForm] = useState({ name: '', phone: '', city: '', distributor: 'RGE' });
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | sending | done
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const discount = SITE_CONFIG.maxDiscount / 100;
  const monthlySavings = billValue * discount;
  const annualSavings = monthlySavings * 12;

  const update = (field) => (e) =>
    setForm({ ...form, [field]: field === 'phone' ? formatPhone(e.target.value) : e.target.value });

  const pickFile = (f) => {
    setError('');
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      return setError(`O arquivo passa de ${MAX_FILE_MB} MB. Tire uma foto da conta ou envie pelo WhatsApp.`);
    }
    if (!VALID_TYPES.includes(f.type) && !/\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name)) {
      return setError('Envie a conta em PDF ou foto (JPG, PNG).');
    }
    setFile(f);
  };

  const removeFile = (e) => {
    e.stopPropagation();
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.name.trim().length < 3) return setError('Informe seu nome.');
    if (form.phone.replace(/\D/g, '').length < 10) return setError('Informe um WhatsApp válido com DDD.');
    if (!form.city.trim()) return setError('Informe sua cidade.');

    const lead = {
      ...form,
      name: form.name.trim(),
      city: form.city.trim(),
      billValue,
      monthlySavings,
      annualSavings,
      hasFile: Boolean(file),
      createdAt: new Date().toISOString(),
      source: window.location.href,
    };

    // Abre a aba do WhatsApp já no clique; abrir depois do envio faz o navegador bloquear o pop-up.
    const waWindow = window.open('', '_blank');

    setStatus('sending');
    let fileUrl = null;
    try {
      fileUrl = await saveLead(lead, file);
    } catch (err) {
      // Mesmo se falhar o envio, a pessoa ainda segue pelo WhatsApp.
      console.error('Falha ao salvar cadastro', err);
    }

    const waUrl = `https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${encodeURIComponent(buildMessage(lead, fileUrl, Boolean(file)))}`;
    if (waWindow) waWindow.location.href = waUrl;
    else window.location.href = waUrl;

    setResult({ lead, waUrl, needsAttachment: Boolean(file) && !fileUrl, fileName: file?.name });
    setStatus('done');
  };

  if (status === 'done' && result) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-400 text-emerald-400 flex items-center justify-center text-2xl mx-auto mb-4">
          ✓
        </div>
        <h3 className="text-2xl font-extrabold text-white mb-2">Cadastro enviado!</h3>
        <p className="text-slate-300 mb-4">
          Abrimos o WhatsApp da nossa equipe com seus dados. <strong className="text-white">Só falta tocar em enviar</strong> na conversa.
        </p>
        {result.needsAttachment && (
          <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4">
            Por segurança, o navegador não anexa arquivos sozinho: na conversa, toque no clipe 📎 e envie <strong>{result.fileName}</strong>.
          </p>
        )}
        <a
          href={result.waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold py-4 px-6 rounded-xl transition-colors"
        >
          O WhatsApp não abriu? Toque aqui
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <h2 className="text-2xl font-extrabold text-white">Simule sua economia</h2>
        <p className="text-sm text-slate-400 mt-1">Cadastro gratuito e sem compromisso.</p>
      </div>

      {/* Simulador */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10">
        <div className="flex justify-between items-baseline gap-3 mb-3">
          <label htmlFor="bill" className="text-sm text-slate-300">Sua conta de luz média</label>
          <span className="text-2xl font-extrabold text-white tabular-nums">{formatBRL(billValue)}</span>
        </div>
        <input
          id="bill"
          type="range"
          min={SITE_CONFIG.minBill}
          max={SITE_CONFIG.maxBill}
          step="50"
          value={billValue}
          onChange={(e) => setBillValue(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1.5">
          <span>{formatBRL(SITE_CONFIG.minBill)}</span>
          <span>{formatBRL(SITE_CONFIG.maxBill)}+</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <span className="block text-xs text-emerald-300">Economia por mês</span>
            <span className="block text-xl font-extrabold text-emerald-400 tabular-nums">{formatBRL(monthlySavings)}</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <span className="block text-xs text-emerald-300">Economia por ano</span>
            <span className="block text-xl font-extrabold text-emerald-400 tabular-nums">{formatBRL(annualSavings)}</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">Estimativa com desconto de até {SITE_CONFIG.maxDiscount}%.</p>
      </div>

      {/* Conta de luz */}
      <div>
        <span className="block text-sm text-slate-300 mb-1.5">Foto ou PDF da sua conta de luz</span>
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-emerald-400 bg-emerald-500/10'
              : file
              ? 'border-emerald-500/60 bg-emerald-500/[0.06]'
              : 'border-white/20 hover:border-emerald-400/50 hover:bg-white/[0.03]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => pickFile(e.target.files?.[0])}
            className="hidden"
          />
          {file ? (
            <div className="flex items-center justify-between gap-3 text-left">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">📄 {file.name}</div>
                <div className="text-xs text-emerald-400">Conta anexada</div>
              </div>
              <button type="button" onClick={removeFile} className="shrink-0 text-xs text-slate-300 px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5">
                Trocar
              </button>
            </div>
          ) : (
            <div>
              <div className="text-sm font-semibold text-white">📎 Toque para anexar ou tirar uma foto</div>
              <div className="text-xs text-slate-500 mt-0.5">PDF ou imagem, até {MAX_FILE_MB} MB · opcional, pode enviar depois no WhatsApp</div>
            </div>
          )}
        </div>
      </div>

      {/* Dados */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="block text-sm text-slate-300 mb-1.5">Nome do titular da conta</label>
          <input id="name" type="text" autoComplete="name" placeholder="Seu nome completo" value={form.name} onChange={update('name')} className={inputClass} />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm text-slate-300 mb-1.5">WhatsApp</label>
          <input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="(54) 99999-9999" value={form.phone} onChange={update('phone')} className={inputClass} />
        </div>
        <div>
          <label htmlFor="city" className="block text-sm text-slate-300 mb-1.5">Cidade</label>
          <input id="city" type="text" autoComplete="address-level2" placeholder="Ex.: Caxias do Sul" value={form.city} onChange={update('city')} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="distributor" className="block text-sm text-slate-300 mb-1.5">Distribuidora de energia</label>
          <select id="distributor" value={form.distributor} onChange={update('distributor')} className={inputClass}>
            {SITE_CONFIG.distributors.map((d) => (
              <option key={d.value} value={d.value} className="text-black">{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-obsidian font-extrabold text-base py-4 px-6 rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
      >
        {status === 'sending' ? 'Enviando…' : 'Ativar meu desconto pelo WhatsApp'}
      </button>

      <p className="text-xs text-slate-500 leading-relaxed">
        Ao enviar, seus dados e sua conta vão para a equipe da Eletrodara pelo WhatsApp, apenas para analisar seu desconto.
        Não compartilhamos com terceiros (LGPD).
      </p>
    </form>
  );
}
