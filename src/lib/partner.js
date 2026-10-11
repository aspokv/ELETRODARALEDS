import { useEffect, useState } from 'react';
import { SITE_CONFIG } from '../config/site';

// O parceiro vem do link de divulgação: /p/<slug> (ou ?parceiro=<slug>).
export function getPartnerSlug() {
  const fromPath = window.location.pathname.match(/^\/p\/([\w-]+)/)?.[1];
  const params = new URLSearchParams(window.location.search);
  return (fromPath || params.get('parceiro') || params.get('vendedor') || '').toLowerCase();
}

// Busca nome e WhatsApp do parceiro. Sem parceiro (ou desativado), usa o número da Eletrodara.
export function usePartner() {
  const [partner, setPartner] = useState(null);

  useEffect(() => {
    const slug = getPartnerSlug();
    if (!slug) return;
    fetch(`/api/parceiro/${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.ok && setPartner(data))
      .catch(() => {});
  }, []);

  return {
    partner,
    whatsappNumber: partner?.whatsapp || SITE_CONFIG.whatsappNumber,
  };
}
