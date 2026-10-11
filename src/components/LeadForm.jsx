import React, { useRef, useState } from 'react';
import { SITE_CONFIG } from '../config/site';

const MAX_FILE_MB = 10;
const VALID_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];

const formatBRL = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatBRLShort = (val) => val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const formatRange = (min, max) => `${formatBRLShort(min)} a ${formatBRLShort(max)}`;

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

// Reduz fotos grandes (celular tira fotos de 3–5 MB) para ~300 KB antes de enviar,
// mantendo a conta legível. PDFs e formatos que o navegador não decodifica (HEIC) vão como estão.
async function compressImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

// Salva o cadastro (e a conta, se houver) no servidor. Retorna o link da conta salva.
async function saveLead(lead, file) {
  const payload = { ...lead };
  if (file) {
    const upload = await compressImage(file);
    payload.file = { name: upload.name, type: upload.type, data: await readAsBase64(upload) };
  }
  const res = await fetch(SITE_CONFIG.leadEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
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
📉 *Economia estimada:* ${formatRange(lead.monthlySavingsMin, lead.monthlySavings)}/mês (${formatRange(lead.annualSavingsMin, lead.annualSavings)}/ano)
${billLine}
-----------------------------------------
Olá! Fiz a simulação no site e quero ativar meu desconto.`;
};

const inputClass =
  'w-full bg-white border border-slate-300 rounded-xl px-4 py-3.5 text-ink text-base placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition';

export function LeadForm({ partner, whatsappNumber }) {
  const fileInputRef = useRef(null);
  const [billValue, setBillValue] = useState(SITE_CONFIG.defaultBill);
  const [form, setForm] = useState({ name: '', phone: '', city: '', distributor: 'RGE' });
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | sending | done
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const monthlySavingsMin = (billValue * SITE_CONFIG.minDiscount) / 100;
  const monthlySavings = (billValue * SITE_CONFIG.maxDiscount) / 100;
  const annualSavingsMin = monthlySavingsMin * 12;
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
      monthlySavingsMin,
      monthlySavings,
      annualSavingsMin,
      annualSavings,
      hasFile: Boolean(file),
      partner: partner?.slug || "",
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

    const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(buildMessage(lead, fileUrl, Boolean(file)))}`;
    if (waWindow) waWindow.location.href = waUrl;
    else window.location.href = waUrl;

    setResult({ lead, waUrl, needsAttachment: Boolean(file) && !fileUrl, fileName: file?.name });
    setStatus('done');
  };

  if (status === 'done' && result) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-brand-light border border-brand text-brand flex items-center justify-center text-2xl mx-auto mb-4">
          ✓
        </div>
        <h3 className="text-2xl font-extrabold text-ink mb-2">Cadastro enviado!</h3>
        <p className="text-slate-600 mb-4">
          Abrimos o WhatsApp {partner ? `de ${partner.name}` : "da nossa equipe"} com seus dados. <strong className="text-ink">Só falta tocar em enviar</strong> na conversa.
        </p>
        {result.needsAttachment && (
          <p className="text-sm text-sun-text bg-sun-light border border-sun/50 rounded-xl p-3 mb-4">
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
        <h2 className="text-2xl font-extrabold text-ink">Simule sua economia</h2>
        <p className="text-sm text-slate-500 mt-1">Cadastro gratuito e sem compromisso.</p>
        {partner && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-brand-dark bg-brand-light rounded-lg px-2.5 py-1">
            Atendimento: <strong>{partner.name}</strong>, parceiro Eletrodara
          </p>
        )}
      </div>

      {/* Simulador */}
      <div className="p-3.5 min-[400px]:p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200">
        <label htmlFor="bill" className="block text-sm font-medium text-slate-700">Valor médio da sua conta</label>
        <output htmlFor="bill" className="block text-3xl font-extrabold text-ink tabular-nums mt-0.5 mb-3">{formatBRL(billValue)}</output>
        <input
          id="bill"
          type="range"
          min={SITE_CONFIG.minBill}
          max={SITE_CONFIG.maxBill}
          step="50"
          value={billValue}
          onChange={(e) => setBillValue(Number(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1.5">
          <span>{formatBRLShort(SITE_CONFIG.minBill)}</span>
          <span>{formatBRLShort(SITE_CONFIG.maxBill)}+</span>
        </div>

        <p className="mt-4 mb-1.5 text-sm font-medium text-slate-700">Sua economia estimada</p>
        <dl className="rounded-xl bg-sun-light border border-sun/50 divide-y divide-sun/30">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5">
            <dt className="text-sm font-medium text-sun-text whitespace-nowrap">Por mês</dt>
            <dd className="text-base min-[360px]:text-lg font-extrabold text-brand-dark tabular-nums whitespace-nowrap">{formatRange(monthlySavingsMin, monthlySavings)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2.5">
            <dt className="text-sm font-medium text-sun-text whitespace-nowrap">Por ano</dt>
            <dd className="text-base min-[360px]:text-lg font-extrabold text-brand-dark tabular-nums whitespace-nowrap">{formatRange(annualSavingsMin, annualSavings)}</dd>
          </div>
        </dl>
        <p className="text-xs text-slate-500 mt-2">Estimativa com desconto de {SITE_CONFIG.minDiscount}% a {SITE_CONFIG.maxDiscount}% na fatura.</p>
      </div>

      {/* Conta de luz */}
      <div>
        <span className="block text-sm font-medium text-slate-700 mb-1.5">Foto ou PDF da sua conta de luz</span>
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
              ? 'border-brand bg-brand-light'
              : file
              ? 'border-brand/60 bg-brand-light/60'
              : 'border-slate-300 hover:border-brand hover:bg-brand-light/40'
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
                <div className="text-sm font-semibold text-ink truncate">📄 {file.name}</div>
                <div className="text-xs font-medium text-brand">Conta anexada</div>
              </div>
              <button type="button" onClick={removeFile} className="shrink-0 text-xs text-slate-600 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100">
                Trocar
              </button>
            </div>
          ) : (
            <div>
              <div className="text-sm font-semibold text-ink">📎 Anexar foto ou PDF</div>
              <div className="text-xs text-slate-500 mt-0.5">Opcional · pode enviar depois no WhatsApp</div>
            </div>
          )}
        </div>
      </div>

      {/* Dados */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">Nome do titular da conta</label>
          <input id="name" type="text" autoComplete="name" placeholder="Seu nome completo" value={form.name} onChange={update('name')} className={inputClass} />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp</label>
          <input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="(54) 99999-9999" value={form.phone} onChange={update('phone')} className={inputClass} />
        </div>
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-1.5">Cidade</label>
          <input id="city" type="text" autoComplete="address-level2" placeholder="Ex.: Caxias do Sul" value={form.city} onChange={update('city')} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="distributor" className="block text-sm font-medium text-slate-700 mb-1.5">Distribuidora de energia</label>
          <select id="distributor" value={form.distributor} onChange={update('distributor')} className={inputClass}>
            {SITE_CONFIG.distributors.map((d) => (
              <option key={d.value} value={d.value} className="text-black">{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-extrabold text-base py-4 px-5 rounded-xl transition-colors shadow-lg shadow-brand/25"
      >
        {status === 'sending' ? 'Enviando…' : (
          <>
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 004.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.03c-.25.69-1.44 1.32-2 1.4-.51.08-1.16.11-1.87-.12-.43-.14-.98-.32-1.69-.62-2.98-1.29-4.93-4.29-5.08-4.49-.15-.2-1.21-1.61-1.21-3.07 0-1.46.77-2.18 1.04-2.48.27-.3.6-.37.79-.37h.57c.18.01.43-.07.67.51.25.6.84 2.06.92 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.6.17.3.77 1.27 1.65 2.06 1.14 1.01 2.09 1.33 2.39 1.48.3.15.47.12.64-.07.18-.2.74-.87.94-1.16.2-.3.4-.25.67-.15.27.1 1.74.82 2.03.97.3.15.5.22.57.35.07.12.07.72-.18 1.41z"/></svg>
            Ativar meu desconto
          </>
        )}
      </button>

      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
        <svg className="w-5 h-5 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span>
          <strong className="text-slate-800">Empresa registrada</strong> · <span className="whitespace-nowrap">CNPJ {SITE_CONFIG.cnpj}</span> · Sede no Parque Tecnológico TecnoUCS, Caxias do Sul/RS
        </span>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        Ao enviar, seus dados e sua conta vão para a equipe da Eletrodara pelo WhatsApp, apenas para analisar seu desconto.
        Não compartilhamos com terceiros (LGPD).
      </p>
    </form>
  );
}
