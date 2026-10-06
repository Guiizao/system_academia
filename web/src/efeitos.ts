/**
 * Efeitos ligados neste aparelho. Mesma ideia do tema: a escolha fica no
 * navegador de quem usa, então o PC da recepção pode ficar quieto enquanto a
 * TV da academia fica mais viva.
 */
import { classesDoHtml, normalizarEfeitos, type IdEfeito } from './dominio/efeitos';

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
  // A lista nova é montada do zero por `classesDoHtml` e escrita de uma vez.
  // Mexer no `classList` durante o laço era o que deixava efeito desmarcado
  // ainda ligado -- a explicação está lá no domínio.
  html.className = classesDoHtml([...html.classList], efeitos).join(' ');
}

export function salvarEfeitos(efeitos: readonly IdEfeito[]) {
  try { localStorage.setItem(CHAVE, JSON.stringify(efeitos)); } catch { /* vale só nesta sessão */ }
  aplicarEfeitos(efeitos);
}
