import { useEffect, useState } from 'react';

// Lista inicial (enquanto a oficial carrega, ou se o Sistema Eletrodara estiver fora do ar).
const FALLBACK = [{ id: '', nome: 'RGE' }, { id: '', nome: 'CEEE Equatorial' }, { id: '', nome: 'Outra' }];

// Concessionárias publicadas no Sistema Eletrodara, via nosso servidor (/api/distribuidoras).
export function useDistribuidoras() {
  const [items, setItems] = useState(FALLBACK);

  useEffect(() => {
    fetch('/api/distribuidoras')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.items?.length && setItems(data.items))
      .catch(() => {});
  }, []);

  return items;
}

export const ESTADOS = ['RS', 'SC', 'PR', 'SP', 'RJ', 'MG', 'ES', 'MS', 'MT', 'GO', 'DF', 'BA', 'SE', 'AL', 'PE', 'PB', 'RN', 'CE', 'PI', 'MA', 'PA', 'AP', 'AM', 'RR', 'AC', 'RO', 'TO'];
