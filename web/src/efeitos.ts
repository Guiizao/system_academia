/**
 * Efeitos ligados neste aparelho. Mesma ideia do tema: a escolha fica no
 * navegador de quem usa, então o PC da recepção pode ficar quieto enquanto a
 * TV da academia fica mais viva.
 */
import { classesDe, normalizarEfeitos, type IdEfeito } from './dominio/efeitos';

const CHAVE = 'df-efeitos';

export function lerEfeitos(): IdEfeito[] {
  try {
    return normalizarEfeitos(JSON.parse(localStorage.getItem(CHAVE) ?? 'null'));
  } catch {
    // navegador sem armazenamento, ou valor estragado: volta para o padrão
    return normalizarEfeitos(null);
  }
}

export function aplicarEfeitos(efeitos: readonly IdEfeito[] = lerEfeitos()) {
  const html = document.documentElement;
  // tira as classes de efeito antigas sem encostar nas outras (tema, modal-aberto)
  html.classList.forEach((c) => { if (c.startsWith('ef-')) html.classList.remove(c); });
  const novas = classesDe(efeitos);
  if (novas) html.classList.add(...novas.split(' '));
}

export function salvarEfeitos(efeitos: readonly IdEfeito[]) {
  try { localStorage.setItem(CHAVE, JSON.stringify(efeitos)); } catch { /* vale só nesta sessão */ }
  aplicarEfeitos(efeitos);
}
