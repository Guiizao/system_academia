/**
 * Tema da interface. Escolha de cada aparelho (fica no navegador dele):
 * o PC da recepcao pode ficar claro e o celular do professor escuro.
 */
import { temaValido, type IdTema } from './dominio/temas';

export type PrefTema = IdTema;
const CHAVE = 'df-tema';
const COR_BARRA: Record<Exclude<IdTema, 'auto'>, string> = {
  escuro: '#111318', cinza: '#1E2127', meianoite: '#0E1522', claro: '#F3F4F6', areia: '#F6F2EA',
};
const sistemaClaro = () => window.matchMedia('(prefers-color-scheme: light)').matches;

export function lerTema(): PrefTema {
  try {
    const v = localStorage.getItem(CHAVE);
    return temaValido(v) ? v : 'escuro';
  } catch { return 'escuro'; }
}

export function aplicarTema(p: PrefTema = lerTema()) {
  const efetivo = p === 'auto' ? (sistemaClaro() ? 'claro' : 'escuro') : p;
  document.documentElement.dataset.tema = efetivo;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA[efetivo]);
}

export function salvarTema(p: PrefTema) {
  try { localStorage.setItem(CHAVE, p); } catch { /* navegador sem armazenamento: vale so nesta sessao */ }
  // a troca de cor atravessa a tela inteira: uma dissolvida curta evita o susto
  const trocar = () => aplicarTema(p);
  const doc = document as Document & { startViewTransition?: (fn: () => void) => void };
  if (doc.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    doc.startViewTransition(trocar);
  } else {
    trocar();
  }
}

/** No modo automatico, acompanha o sistema quando ele troca (ex.: modo noturno do celular). */
export function acompanharSistema() {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (lerTema() === 'auto') aplicarTema('auto');
  });
}
