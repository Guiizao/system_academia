import type { Aviso } from '../tipos';

/**
 * "Limpar avisos" sem apagar a realidade.
 *
 * O sino nao guarda mensagens: ele mostra o que esta acontecendo AGORA (quem
 * venceu, quem sumiu, que ficha parou). Apagar de verdade seria mentira --
 * amanha o aluno continua vencido. Entao marcamos como VISTO: sai da contagem
 * e so volta se a situacao mudar, porque o detalhe entra na chave
 * ("vencida há 1 dia" e "vencida há 2 dias" sao avisos diferentes).
 *
 * Fica no aparelho de quem marcou. A recepcao limpar no balcao nao apaga o
 * aviso do celular do dono -- cada um confere o seu.
 */
const PREFIXO = 'df-avisos-vistos:';
const LIMITE_PADRAO = 300;

function padrao(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function chaveDoAviso(a: Aviso): string {
  return `${a.tipo}|${a.alunoId ?? '-'}|${a.detalhe}`;
}

function lerVistos(usuarioId: number, loja: Storage | null): string[] {
  if (!loja) return [];
  try {
    const bruto = loja.getItem(`${PREFIXO}${usuarioId}`);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

function gravar(usuarioId: number, chaves: string[], loja: Storage | null): void {
  try { loja?.setItem(`${PREFIXO}${usuarioId}`, JSON.stringify(chaves)); } catch { /* segue sem marcar */ }
}

export function filtrarNaoVistos(avisos: Aviso[], usuarioId: number, loja = padrao()): Aviso[] {
  const vistos = new Set(lerVistos(usuarioId, loja));
  return avisos.filter((a) => !vistos.has(chaveDoAviso(a)));
}

export function marcarTodosComoVistos(avisos: Aviso[], usuarioId: number, loja = padrao()): void {
  const atuais = lerVistos(usuarioId, loja);
  const novas = avisos.map(chaveDoAviso).filter((c) => !atuais.includes(c));
  if (novas.length) gravar(usuarioId, [...atuais, ...novas].slice(-LIMITE_PADRAO), loja);
}

/** Mantem so as ultimas: a lista nao pode crescer sem fim no navegador. */
export function limparVistosAntigos(usuarioId: number, loja = padrao(), limite = LIMITE_PADRAO): void {
  const atuais = lerVistos(usuarioId, loja);
  if (atuais.length > limite) gravar(usuarioId, atuais.slice(-limite), loja);
}
