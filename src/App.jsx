import React from 'react';
import { Header } from './components/Header';
import { LeadForm } from './components/LeadForm';
import { SITE_CONFIG } from './config/site';

const whatsappUrl = `https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${encodeURIComponent(
  'Olá! Vi o site da Eletrodara e quero saber mais sobre o desconto na minha conta de luz.'
)}`;

function Check() {
  return (
    <span className="w-6 h-6 shrink-0 rounded-full bg-brand-light text-brand flex items-center justify-center">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

export default function App() {
  return (
    <div id="topo" className="min-h-screen bg-white text-slate-700 font-sans">
      <Header />

      <main>
        {/* HERO + CADASTRO */}
        <section className="relative overflow-hidden bg-gradient-to-b from-brand-light via-white to-white">
          <div className="absolute -top-32 -right-32 w-[480px] h-[480px] bg-sun/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-16 sm:pt-16 sm:pb-24 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-brand/20 text-xs font-medium text-brand-dark mb-5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                Lei Federal 14.300/2022 · Regulado pela ANEEL
              </span>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-ink leading-[1.08] mb-5">
                Economize de <span className="text-brand">{SITE_CONFIG.minDiscount}% a {SITE_CONFIG.maxDiscount}%</span> na sua conta de luz.
              </h1>

              <p className="text-lg text-slate-600 leading-relaxed mb-7 max-w-xl">
                Energia solar por assinatura, sem obras, sem placas e sem investimento. O desconto vem direto na
                fatura da sua distribuidora.
              </p>

              <ul className="grid sm:grid-cols-2 gap-3 max-w-xl">
                {SITE_CONFIG.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-slate-800 font-medium">
                    <Check />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div id="cadastro" className="scroll-mt-24 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-brand/10">
              <LeadForm />
            </div>
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="border-t border-slate-200 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight text-center mb-3">Como funciona</h2>
            <p className="text-slate-600 text-center max-w-2xl mx-auto mb-10">
              Você continua recebendo a mesma energia, pelos mesmos fios. Só a conta fica menor.
            </p>

            <ol className="grid md:grid-cols-3 gap-5">
              {SITE_CONFIG.steps.map((s, i) => (
                <li key={s.title} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-brand text-white font-bold mb-4">
                    {i + 1}
                  </span>
                  <h3 className="text-lg font-bold text-ink mb-1.5">{s.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{s.text}</p>
                </li>
              ))}
            </ol>

            <div className="text-center mt-10">
              <a href="#cadastro" className="inline-flex items-center bg-brand hover:bg-brand-dark text-white font-bold px-7 py-3.5 rounded-xl transition-colors">
                Simular minha economia
              </a>
            </div>
          </div>
        </section>

        {/* PERGUNTAS FREQUENTES */}
        <section id="duvidas" className="border-t border-slate-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight text-center mb-10">Perguntas frequentes</h2>

            <div className="space-y-3">
              {SITE_CONFIG.faq.map((item) => (
                <details key={item.q} className="group rounded-2xl bg-white border border-slate-200 open:border-brand/40 open:shadow-sm">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none p-5 font-semibold text-ink">
                    {item.q}
                    <span className="text-brand text-xl leading-none transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="px-5 pb-5 -mt-1 text-slate-600 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="bg-brand">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">Pronto para pagar menos de luz?</h2>
            <p className="text-white/85 mb-8">O cadastro é gratuito e sem compromisso.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="#cadastro" className="inline-flex items-center justify-center bg-white hover:bg-sun-light text-brand-dark font-bold px-7 py-3.5 rounded-xl transition-colors">
                Simular minha economia
              </a>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center border border-white/50 hover:bg-white/10 text-white font-semibold px-7 py-3.5 rounded-xl transition-colors">
                Tirar dúvidas no WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-50 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 text-sm text-slate-500 space-y-1.5 text-center">
          <img src="/logo.png" alt="Eletrodara Gestão de Energia" width="762" height="164" className="h-10 w-auto mx-auto mb-4" loading="lazy" />
          <p className="text-slate-700 font-semibold">{SITE_CONFIG.company}</p>
          <p>CNPJ {SITE_CONFIG.cnpj}</p>
          <p>{SITE_CONFIG.headquarters}</p>
          <p>WhatsApp {SITE_CONFIG.phoneFormatted}</p>
          <p className="pt-3 text-xs text-slate-400">
            Geração Distribuída compartilhada conforme a Lei Federal 14.300/2022 e as resoluções da ANEEL.
          </p>
        </div>
      </footer>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:block fixed bottom-5 right-5 z-50 p-4 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white shadow-xl shadow-black/20 transition-transform hover:scale-105"
        aria-label="Falar no WhatsApp"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>
    </div>
  );
}
