import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useProductStore } from '../../store/useProductStore';
import { PRODUCT_CONFIG } from '../../config/product';

gsap.registerPlugin(ScrollTrigger);

export function ScrollNarrative() {
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const setScrollProgress = useProductStore((state) => state.setScrollProgress);
  const setExplodedProgress = useProductStore((state) => state.setExplodedProgress);
  const billValue = useProductStore((state) => state.billValue);
  const setBillValue = useProductStore((state) => state.setBillValue);
  const isFreeOrbit = useProductStore((state) => state.isFreeOrbit);
  const setIsFreeOrbit = useProductStore((state) => state.setIsFreeOrbit);

  // Form State (Single Unified Screen)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    city: '',
    distributor: 'RGE',
    billAbove250: true,
    isHolder: true,
  });

  // File Upload State
  const [attachedFile, setAttachedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showHandoverModal, setShowHandoverModal] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.2,
      onUpdate: (self) => {
        const p = self.progress;
        setScrollProgress(p);

        // Exploded view animation triggers during the 3D Deep Dive section (around 42% - 72%)
        if (p >= 0.42 && p <= 0.72) {
          const exp = (p - 0.42) / (0.72 - 0.42);
          const curve = Math.sin(exp * Math.PI);
          setExplodedProgress(curve);
        } else {
          setExplodedProgress(0);
        }
      },
    });

    return () => {
      st.kill();
    };
  }, [setScrollProgress, setExplodedProgress]);

  // Smooth Scroll Helper
  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // Currency Formatter
  const formatBRL = (val) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Calculations based on current bill value
  const discountRate = 0.25;
  const monthlySavings = billValue * discountRate;
  const annualSavings = monthlySavings * 12;
  const newBillValue = billValue - monthlySavings;

  // File handling & validation
  const validateAndSetFile = (file) => {
    setUploadError('');
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setUploadError('O arquivo selecionado excede o limite máximo de 15MB.');
      return;
    }

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|jpe?g|png|webp)$/i)) {
      setUploadError('Formato inválido. Por favor, selecione um arquivo em PDF ou uma imagem (.jpg, .png).');
      return;
    }

    setAttachedFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    validateAndSetFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    validateAndSetFile(file);
  };

  const removeFile = (e) => {
    e.stopPropagation();
    setAttachedFile(null);
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // =========================================================================
  // SUBMISSION: ENVIAR COM CONTA ANEXADA
  // =========================================================================
  const handleSubmitWithFile = (e) => {
    e.preventDefault();
    setUploadError('');

    if (!formData.name.trim() || !formData.phone.trim()) {
      setUploadError('Por favor, preencha seu Nome Completo e WhatsApp.');
      return;
    }

    if (!formData.billAbove250) {
      setUploadError('O benefício é exclusivo para faturas a partir de R$ 250,00 por mês.');
      return;
    }

    if (!attachedFile) {
      setUploadError('⚠️ Por favor, anexe a foto ou PDF da sua conta de luz, ou utilize a opção "Enviar Foto pelo WhatsApp".');
      return;
    }

    const fileSizeFormatted = (attachedFile.size / (1024 * 1024)).toFixed(2) + ' MB';

    const msg = `⚡ *SOLICITAÇÃO DE DESCONTO - ELETRODARA (CONTA ANEXADA)* ⚡
-----------------------------------------
👤 *Titular:* ${formData.name}
📱 *WhatsApp:* ${formData.phone}
📍 *Cidade:* ${formData.city || 'Não informada'}
🏢 *Distribuidora:* ${formData.distributor}
💰 *Valor Médio da Fatura:* ${formatBRL(billValue)}
📉 *Economia Estimada:* ${formatBRL(monthlySavings)}/mês (${formatBRL(annualSavings)}/ano)
-----------------------------------------
📄 *DOCUMENTO SELECIONADO:* ${attachedFile.name} (${fileSizeFormatted})
-----------------------------------------
👉 *Olá! Preenchi a simulação no site e estou enviando minha fatura logo abaixo para validação técnica e liberação da cota de desconto.*`;

    const url = `https://wa.me/${PRODUCT_CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
    setShowHandoverModal(true);
    window.open(url, '_blank');
  };

  // =========================================================================
  // SUBMISSION: ENVIAR FOTO DIRETO NO CHAT
  // =========================================================================
  const handleDirectChat = () => {
    setUploadError('');

    const leadName = formData.name.trim() || 'Titular';
    const leadPhone = formData.phone.trim() || 'Informado no chat';

    const msg = `⚡ *SOLICITAÇÃO DE DESCONTO - ELETRODARA (FOTO PELO CHAT)* ⚡
-----------------------------------------
👤 *Titular:* ${leadName}
📱 *WhatsApp:* ${leadPhone}
📍 *Cidade:* ${formData.city || 'Não informada'}
🏢 *Distribuidora:* ${formData.distributor}
💰 *Valor Médio da Fatura:* ${formatBRL(billValue)}
📉 *Economia Estimada:* ${formatBRL(monthlySavings)}/mês (${formatBRL(annualSavings)}/ano)
-----------------------------------------
👉 *Olá! Preenchi a simulação no site e estou tirando a foto da minha conta de luz agora para enviar aqui no chat e aprovar minha cota de desconto.*`;

    const url = `https://wa.me/${PRODUCT_CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div ref={containerRef} className="relative z-10 w-full pointer-events-none">
      
      {/* ========================================================
          DOBRA 1: HERO INSTITUCIONAL DE ALTO IMPACTO
         ======================================================== */}
      <section id="hero" className="min-h-screen flex flex-col justify-start items-center text-center px-4 sm:px-6 relative pt-24 sm:pt-28 pb-16">
        <div className="max-w-4xl mx-auto pointer-events-auto relative z-20">
          
          {/* Subtle billionaire radial contrast veil */}
          <div className="absolute -inset-x-8 -top-8 -bottom-10 bg-radial from-[#050507]/95 via-[#050507]/75 to-transparent -z-10 blur-3xl pointer-events-none rounded-[3rem]" />

          {/* Institutional Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-black/70 border border-white/10 backdrop-blur-xl mb-6 shadow-xl shadow-black/60">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
            <span className="text-xs sm:text-sm font-mono font-bold text-slate-200 tracking-wide">
              Economia Garantida por Lei Federal 14.300/22 · Homologada ANEEL
            </span>
          </div>

          {/* Crisp, Editorial Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[5.25rem] font-black tracking-[-0.03em] text-white uppercase leading-[1.04] mb-6 drop-shadow-[0_4px_30px_rgba(0,0,0,0.95)]">
            Economize até <span className="text-emerald-400 drop-shadow-[0_0_35px_rgba(52,211,153,0.4)]">25%</span> na sua conta de luz.
          </h1>

          <p className="text-lg sm:text-2xl text-slate-200 font-semibold max-w-2xl mx-auto leading-relaxed mb-8 drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)]">
            Sem obras. Sem placas. Sem nenhum investimento. <br className="hidden sm:inline" />
            <span className="text-slate-400 text-base sm:text-lg font-normal">
              Conectamos sua residência ou empresa a usinas solares homologadas por meio de créditos diretos na sua fatura habitual.
            </span>
          </p>

          {/* Metric cards with solid dark aerospace finish */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto mb-8 text-left">
            <div className="p-4 rounded-2xl bg-[#090b12]/95 border border-white/10 backdrop-blur-2xl shadow-2xl">
              <div className="text-emerald-400 font-mono font-black text-xl">R$ 0</div>
              <div className="text-xs text-slate-300 font-medium mt-0.5">Adesão ou mensalidade</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#090b12]/95 border border-white/10 backdrop-blur-2xl shadow-2xl">
              <div className="text-emerald-400 font-mono font-black text-xl">ZERO</div>
              <div className="text-xs text-slate-300 font-medium mt-0.5">Obras ou placas solares</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#090b12]/95 border border-white/10 backdrop-blur-2xl shadow-2xl">
              <div className="text-emerald-400 font-mono font-black text-xl">100%</div>
              <div className="text-xs text-slate-300 font-medium mt-0.5">Regulado pela ANEEL</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#090b12]/95 border border-white/10 backdrop-blur-2xl shadow-2xl">
              <div className="text-emerald-400 font-mono font-black text-xl">LIVRE</div>
              <div className="text-xs text-slate-300 font-medium mt-0.5">Sem fidelidade contratual</div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={() => scrollToSection('terminal')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-obsidian font-black text-sm px-8 py-4 rounded-2xl transition-all shadow-xl shadow-emerald-500/25 hover:scale-105 active:scale-95 uppercase tracking-wider"
            >
              <span>SIMULAR & ATIVAR MEU DESCONTO</span>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>

            <button
              onClick={() => scrollToSection('tecnologia')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/15 text-white font-mono font-bold text-xs px-6 py-4 rounded-2xl transition-all backdrop-blur-md shadow-lg shadow-black/40"
            >
              <span>COMO FUNCIONA</span>
            </button>

            <button
              onClick={() => setIsFreeOrbit(!isFreeOrbit)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-black/60 hover:bg-white/10 border border-white/15 text-slate-300 hover:text-white font-mono font-bold text-xs px-5 py-4 rounded-2xl transition-all"
            >
              <span>↻ {isFreeOrbit ? 'SCROLL' : '360° LIVRE'}</span>
            </button>
          </div>

        </div>
      </section>

      {/* ========================================================
          DOBRA 2: SIMULAÇÃO & ATIVAÇÃO NA MESMA TELA (SEM ABAS)
         ======================================================== */}
      <section id="terminal" className="min-h-screen flex items-center justify-center px-4 sm:px-8 py-20">
        <div className="w-full max-w-4xl pointer-events-auto bg-[#080a12]/95 backdrop-blur-2xl p-6 sm:p-10 rounded-3xl border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.95)] relative">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs uppercase mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>TERMINAL DE ATIVAÇÃO · RESIDENCIAL & EMPRESARIAL</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight mb-2">
              Simule sua Economia & Solicite sua Cota
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto">
              Ajuste o valor da sua fatura no controle abaixo e envie sua conta para laudo técnico e ativação imediata pela equipe de engenharia da Eletrodara.
            </p>
          </div>

          {/* 1. SIMULADOR INTERATIVO (PRIMEIRO ELEMENTO DA TELA) */}
          <div className="mb-8 p-6 rounded-2xl bg-white/[0.02] border border-white/10">
            <div className="flex justify-between items-baseline mb-4">
              <span className="text-xs font-mono text-slate-400 uppercase font-bold tracking-wider">
                Valor Médio Atual da sua Fatura:
              </span>
              <span className="text-3xl sm:text-5xl font-mono font-black text-emerald-400">
                {formatBRL(billValue)}
              </span>
            </div>

            <input
              type="range"
              min="250"
              max="10000"
              step="50"
              value={billValue}
              onChange={(e) => setBillValue(Number(e.target.value))}
              className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />

            <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-2 font-bold">
              <span>R$ 250 (Mínimo)</span>
              <span>R$ 2.500</span>
              <span>R$ 5.000</span>
              <span>R$ 10.000+</span>
            </div>
          </div>

          {/* Output Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block mb-1">
                DESCONTO ESTIMADO NA SUA CONTA
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-black text-white">
                {formatBRL(monthlySavings)} <span className="text-xs font-sans text-slate-400 font-normal">/mês a menos</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Sua nova fatura passa a ser aprox. <strong className="text-emerald-400">{formatBRL(newBillValue)}</strong>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-300 block mb-1">
                ECONOMIA TOTAL ACUMULADA NO ANO
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-black text-emerald-400">
                {formatBRL(annualSavings)}
              </div>
              <div className="text-xs text-emerald-300/80 mt-1">
                Economia líquida creditada direto na sua distribuidora habitual.
              </div>
            </div>
          </div>

          {/* DIVISOR INSTITUCIONAL */}
          <div className="relative flex py-4 items-center mb-8">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink mx-4 text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
              DADOS PARA EMISSÃO & ATIVAÇÃO DA COTA
            </span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          {/* 2. FORMULÁRIO DE ATIVAÇÃO & ANEXO NA MESMA TELA */}
          <form onSubmit={handleSubmitWithFile} className="space-y-6 text-left">
            
            {/* Campo de Upload da Conta */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono font-bold text-slate-200 uppercase">
                  Anexe a Foto ou PDF da sua Conta de Luz *
                </label>
                <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                  Laudo em até 15 minutos
                </span>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 sm:p-7 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-emerald-400 bg-emerald-500/15'
                    : attachedFile
                    ? 'border-emerald-500/60 bg-emerald-950/25 shadow-lg shadow-emerald-500/10'
                    : 'border-white/20 bg-black/40 hover:border-emerald-400/50 hover:bg-black/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!attachedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl text-emerald-400">
                      📎
                    </div>
                    <div className="text-sm font-bold text-white">
                      Clique para selecionar ou arraste o arquivo da fatura aqui
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      Formatos suportados: PDF, JPG, PNG ou WEBP (Até 15MB)
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-left">
                      <span className="text-3xl">📄</span>
                      <div>
                        <div className="text-sm font-bold text-white truncate max-w-[280px]">
                          {attachedFile.name}
                        </div>
                        <div className="text-xs text-emerald-400 font-mono">
                          ✓ Documento pronto para envio ({(attachedFile.size / (1024 * 1024)).toFixed(2)} MB)
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={removeFile}
                      className="text-xs text-red-400 font-mono px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                    >
                      Substituir Arquivo
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Dados do Titular */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Nome Completo do Titular *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo Silveira"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#050507] border border-white/15 rounded-xl px-4 py-3.5 text-white text-sm focus:border-emerald-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">WhatsApp com DDD *</label>
                <input
                  type="tel"
                  required
                  placeholder="(54) 99000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-[#050507] border border-white/15 rounded-xl px-4 py-3.5 text-white text-sm focus:border-emerald-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Distribuidora de Energia *</label>
                <select
                  value={formData.distributor}
                  onChange={(e) => setFormData({ ...formData, distributor: e.target.value })}
                  className="w-full bg-[#050507] border border-white/15 rounded-xl px-4 py-3.5 text-white text-sm focus:border-emerald-400 outline-none"
                >
                  <option value="RGE">RGE (RS)</option>
                  <option value="CPFL">CPFL (SP)</option>
                  <option value="CEMIG">CEMIG (MG)</option>
                  <option value="ENEL">ENEL (SP/RJ/CE)</option>
                  <option value="COPEL">Copel (PR)</option>
                  <option value="CELESC">Celesc (SC)</option>
                  <option value="NEOENERGIA">Neoenergia</option>
                  <option value="OUTRA">Outra Concessionária</option>
                </select>
              </div>
            </div>

            {/* Critérios Regulatórios */}
            <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 space-y-2">
              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.billAbove250}
                  onChange={(e) => setFormData({ ...formData, billAbove250: e.target.checked })}
                  className="w-4 h-4 rounded accent-emerald-400 cursor-pointer"
                  required
                />
                <span>Minha conta de luz possui valor médio <strong>a partir de R$ 250,00 por mês</strong>.</span>
              </label>
              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isHolder}
                  onChange={(e) => setFormData({ ...formData, isHolder: e.target.checked })}
                  className="w-4 h-4 rounded accent-emerald-400 cursor-pointer"
                  required
                />
                <span>Sou o titular da unidade consumidora ou representante legal do imóvel.</span>
              </label>
            </div>

            {uploadError && (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
                {uploadError}
              </div>
            )}

            {/* Ações de Envio */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-obsidian font-black text-sm py-4 px-6 rounded-xl transition-all shadow-xl shadow-emerald-500/25 hover:scale-[1.01] active:scale-[0.99] uppercase"
              >
                <span>ATIVAR DESCONTO & ENVIAR CONTA NO WHATSAPP</span>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>

              <button
                type="button"
                onClick={handleDirectChat}
                className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-mono font-bold text-xs py-4 px-6 rounded-xl transition-all shadow-lg shadow-green-500/20"
              >
                <span>📸 Enviar Foto da Conta pelo WhatsApp</span>
              </button>
            </div>

          </form>

        </div>
      </section>

      {/* ========================================================
          HANDOVER MODAL (Instrução Clara pós-abertura do WhatsApp)
         ======================================================== */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/85 backdrop-blur-xl pointer-events-auto">
          <div className="max-w-md w-full bg-[#0a0d14] border border-emerald-500/40 rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-400 flex items-center justify-center text-2xl mx-auto mb-4">
              ✓
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              WhatsApp Aberto com Sucesso!
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              Como os navegadores não podem anexar arquivos automaticamente por segurança, <strong>basta clicar no ícone de anexo (grampo) no WhatsApp e enviar o arquivo ({attachedFile?.name})</strong> que você selecionou.
            </p>
            <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-emerald-300 font-mono mb-6">
              Nossa equipe técnica responderá em até 15 minutos com o laudo aprovado da sua cota.
            </div>
            <button
              onClick={() => setShowHandoverModal(false)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-obsidian font-mono font-bold text-xs rounded-xl uppercase transition-colors"
            >
              Entendido, vou enviar o documento no chat
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          DOBRA 3: COMO FUNCIONA O DESCONTO (MARCO LEGAL DA LEI 14.300)
         ======================================================== */}
      <section id="tecnologia" className="min-h-screen flex flex-col justify-center items-center text-center px-4 sm:px-8 py-24">
        <div className="max-w-3xl pointer-events-auto bg-[#080a12]/95 backdrop-blur-2xl p-8 sm:p-10 rounded-3xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]">
          <span className="text-xs font-mono font-bold text-emerald-400 tracking-widest uppercase block mb-2">
            TRANSPARÊNCIA TOTAL // MARCO LEGAL LEI FEDERAL 14.300/22
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight mb-4">
            Como Você Economiza Sem Instalar Placas Nem Fazer Obras
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
            A energia solar é gerada em usinas parceiras de alta escala e injetada diretamente na rede pública da sua concessionária local (como RGE, CPFL, CEMIG, etc.). Por meio da Lei Federal 14.300/22 regulamentada pela ANEEL, essa energia é convertida em créditos oficiais que abatem até 25% do valor da sua fatura todo mês. Você continua recebendo a mesma eletricidade confiável pelos mesmos fios, sem mexer em nada no seu imóvel.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mb-6">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-emerald-400 font-mono font-bold text-xs block mb-1">01. USINAS SOLARES PARCEIRAS</span>
              <p className="text-xs text-slate-400">Grandes parques solares geram energia limpa com custo até 40% menor do que hidrelétricas e termelétricas tradicionais.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-emerald-400 font-mono font-bold text-xs block mb-1">02. CRÉDITOS NA CONCESSIONÁRIA</span>
              <p className="text-xs text-slate-400">A energia é entregue na rede pública e a distribuidora homologa os créditos no seu número de instalação.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-emerald-400 font-mono font-bold text-xs block mb-1">03. DESCONTO DIRETO NA FATURA</span>
              <p className="text-xs text-slate-400">Você recebe até 25% de desconto líquido na sua fatura habitual, sem fidelidade e sem gastar R$ 1 em equipamentos.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setIsFreeOrbit(!isFreeOrbit)}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-mono font-bold text-xs transition-colors"
            >
              {isFreeOrbit ? 'Voltar ao Scroll' : 'Girar em 360°'}
            </button>
            <button
              onClick={() => scrollToSection('terminal')}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-obsidian font-mono font-bold text-xs transition-colors uppercase"
            >
              Solicitar Minha Cota →
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================
          DOBRA 4: DEPOIMENTOS DE CLIENTES HOMOLOGADOS
         ======================================================== */}
      <section className="min-h-screen flex flex-col justify-center items-center px-4 sm:px-8 py-24">
        <div className="max-w-5xl mx-auto pointer-events-auto">
          
          <div className="text-center mb-12">
            <span className="text-xs font-mono font-bold text-emerald-400 tracking-widest uppercase block mb-2">
              DEPOIMENTOS DE CLIENTES
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight">
              Economia Real Comprovada em Fatura
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-[#080a12]/95 backdrop-blur-xl border border-white/10 flex flex-col justify-between shadow-2xl">
              <div>
                <div className="text-amber-400 text-xs mb-3 font-mono">★★★★★ CLIENTE RESIDENCIAL</div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed italic mb-4">
                  "No começo achei que era bom demais para ser verdade. Como economizar sem pagar nada? A equipe me atendeu no WhatsApp, explicou a Lei 14.300 e mandei minha conta. Já no primeiro mês a economia foi de R$ 185! Muito satisfeito."
                </p>
              </div>
              <div className="pt-4 border-t border-white/5 text-xs">
                <div className="font-bold text-white">Rodrigo Martins</div>
                <div className="text-slate-400 font-mono text-[11px]">Residencial · Caxias do Sul / RS</div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[#080a12]/95 backdrop-blur-xl border border-white/10 flex flex-col justify-between shadow-2xl">
              <div>
                <div className="text-amber-400 text-xs mb-3 font-mono">★★★★★ CLIENTE COMERCIAL</div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed italic mb-4">
                  "Na minha padaria a conta de luz é um dos maiores custos fixos. A Eletrodara reduziu mais de R$ 900 por mês, sem nenhuma alteração elétrica no imóvel. É dinheiro direto no caixa da empresa todo mês."
                </p>
              </div>
              <div className="pt-4 border-t border-white/5 text-xs">
                <div className="font-bold text-white">Carlos Silveira</div>
                <div className="text-slate-400 font-mono text-[11px]">Comércio · Bento Gonçalves / RS</div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[#080a12]/95 backdrop-blur-xl border border-white/10 flex flex-col justify-between shadow-2xl">
              <div>
                <div className="text-amber-400 text-xs mb-3 font-mono">★★★★★ CLIENTE RESIDENCIAL</div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed italic mb-4">
                  "O atendimento foi transparente e objetivo. Esclareceram todas as dúvidas antes de eu enviar o documento. O procedimento foi rápido e o desconto vem pontualmente discriminado na conta."
                </p>
              </div>
              <div className="pt-4 border-t border-white/5 text-xs">
                <div className="font-bold text-white">Mariana Fagundes</div>
                <div className="text-slate-400 font-mono text-[11px]">Residencial · Flores da Cunha / RS</div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================
          DOBRA 5: MATRIZ DE COMPLIANCE & LASTRO INSTITUCIONAL
         ======================================================== */}
      <section className="py-24 px-4 sm:px-8 flex flex-col justify-center items-center">
        <div className="max-w-4xl mx-auto w-full pointer-events-auto bg-[#080a12]/95 backdrop-blur-2xl p-8 sm:p-10 rounded-3xl border border-white/10 shadow-2xl">
          
          <div className="text-center mb-8">
            <span className="text-xs font-mono font-bold text-emerald-400 tracking-widest uppercase block mb-2">
              SEGURANÇA JURÍDICA E TÉCNICA
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
              Especificações Institucionais do Serviço
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {PRODUCT_CONFIG.specs.map((s, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex justify-between items-center text-xs">
                <span className="text-slate-400 font-mono">{s.label}:</span>
                <span className="text-white font-bold text-right">{s.value}</span>
              </div>
            ))}
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div>
              <div className="text-sm font-bold text-white mb-1">
                Eletrodara Gestão de Energia Ltda.
              </div>
              <div className="text-xs text-slate-400 font-mono">
                CNPJ: {PRODUCT_CONFIG.cnpj} · Sediada no {PRODUCT_CONFIG.headquarters}
              </div>
            </div>
            <button
              onClick={() => scrollToSection('terminal')}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-obsidian font-mono font-bold text-xs shrink-0 transition-transform active:scale-95 uppercase"
            >
              <span>Solicitar Minha Cota</span>
              <span>→</span>
            </button>
          </div>

        </div>
      </section>

      {/* ========================================================
          DOBRA FINAL: CHAMADA À AÇÃO DEFINITIVA
         ======================================================== */}
      <section className="py-20 px-4 sm:px-8 flex flex-col justify-center items-center">
        <div className="max-w-4xl mx-auto w-full pointer-events-auto bg-gradient-to-b from-[#0a0d16] to-[#06080e] p-8 sm:p-12 rounded-3xl border border-emerald-500/30 shadow-[0_30px_90px_rgba(0,0,0,0.95)] text-center relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-32 -mt-32" />

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs uppercase mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>SOLICITAÇÃO DE COTA · HOMOLOGAÇÃO IMEDIATA</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight mb-4">
            Pronto para Economizar até 25% na sua Conta?
          </h2>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            Sem obras, sem placas e sem gastar nenhum centavo. Suba para o simulador ou abra a conversa com um engenheiro técnico da Eletrodara no WhatsApp para emitir seu laudo de economia em até 15 minutos.
          </p>

          <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => scrollToSection('terminal')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-obsidian font-black text-sm py-4 px-8 rounded-2xl shadow-xl shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 uppercase tracking-wide"
            >
              <span>SUBIR PARA O SIMULADOR & ANEXAR</span>
              <span>↑</span>
            </button>
            <button
              onClick={handleDirectChat}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-mono font-bold text-xs py-4 px-6 rounded-2xl shadow-lg shadow-green-500/20 transition-all hover:scale-105 active:scale-95"
            >
              <span>Falar com Especialista no WhatsApp</span>
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-center gap-6 text-[11px] font-mono text-slate-400">
            <span>✓ Laudo técnico em até 15 minutos</span>
            <span>✓ R$ 0 de custo de adesão</span>
            <span>✓ Regulado pela ANEEL (Lei 14.300)</span>
            <span>✓ Atendimento corporativo direto</span>
          </div>

        </div>
      </section>

      {/* ========================================================
          FOOTER
         ======================================================== */}
      <footer className="py-12 px-4 sm:px-8 border-t border-white/10 bg-[#04060a] text-center text-xs text-slate-500 font-mono pointer-events-auto">
        <p className="mb-2 text-slate-400">
          © 2026 Eletrodara Gestão de Energia. Todos os direitos reservados.
        </p>
        <p className="text-[11px] text-slate-600 max-w-xl mx-auto">
          Geração Distribuída compartilhada em conformidade com a Lei Federal 14.300/22 e Resoluções Normativas da Agência Nacional de Energia Elétrica (ANEEL).
        </p>
      </footer>

    </div>
  );
}
