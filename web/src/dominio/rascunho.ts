/**
 * Rascunho de formulario: o que foi digitado fica no proprio aparelho ate a
 * pessoa salvar ou descartar. Fechar sem querer (Esc, X, clique fora) deixou
 * de custar o cadastro inteiro.
 *
 * Fica so no navegador de quem digitou, por usuario -- o colega do outro turno
 * nao ve o rascunho alheio. Vale 24 horas: rascunho de semana passada
 * atrapalha mais do que ajuda. Senha nunca entra aqui.
 */
const PREFIXO = 'df-rascunho:';
export const VALIDADE_MS = 24 * 60 * 60 * 1000;

type Guardado<T> = { em: number; dados: T };

function padrao(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function chaveRascunho(usuarioId: number, formulario: string, alvo: number | string = 'novo'): string {
  return `${PREFIXO}${usuarioId}:${formulario}:${alvo}`;
}

/** `dados` nulo apaga: formulario vazio nao merece rascunho. */
export function salvarRascunho<T>(chave: string, dados: T | null, loja = padrao(), agora = Date.now()): void {
  if (!loja) return;
  try {
    if (dados === null) loja.removeItem(chave);
    else loja.setItem(chave, JSON.stringify({ em: agora, dados } satisfies Guardado<T>));
  } catch { /* aba anonima ou armazenamento cheio: seguir sem rascunho */ }
}

export function lerRascunho<T>(chave: string, loja = padrao(), agora = Date.now()): T | null {
  if (!loja) return null;
  try {
    const bruto = loja.getItem(chave);
    if (!bruto) return null;
    const g = JSON.parse(bruto) as Guardado<T>;
    if (typeof g?.em !== 'number' || agora - g.em > VALIDADE_MS) { loja.removeItem(chave); return null; }
    return g.dados ?? null;
  } catch { return null; }
}

export function limparRascunho(chave: string, loja = padrao()): void {
  try { loja?.removeItem(chave); } catch { /* nada a fazer */ }
}

/** Ao sair, o rascunho vai junto: o proximo turno nao herda o que ficou pela metade. */
export function limparRascunhosDoUsuario(usuarioId: number, loja = padrao()): void {
  if (!loja) return;
  try {
    const meu = `${PREFIXO}${usuarioId}:`;
    const apagar: string[] = [];
    for (let i = 0; i < loja.length; i++) {
      const k = loja.key(i);
      if (k?.startsWith(meu)) apagar.push(k);
    }
    apagar.forEach((k) => loja.removeItem(k));
  } catch { /* nada a fazer */ }
}
