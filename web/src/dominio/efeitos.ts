/**
 * Efeitos opcionais da interface.
 *
 * Separado do tema de propósito: tema é a cor, efeito é o movimento. Quem
 * trabalha o dia inteiro no sistema pode querer tudo quieto; quem mostra a
 * academia para um aluno novo pode querer a tela mais viva.
 *
 * Cada efeito vira uma classe `ef-<id>` no <html> e o resto é CSS -- sem
 * biblioteca de animação e sem peso no bundle. Todos respeitam
 * `prefers-reduced-motion`: com ele ligado no aparelho, nada se mexe.
 */

export type IdEfeito =
  // movimento: como a tela reage
  | 'relevo' | 'foco-vivo' | 'cascata' | 'respiro' | 'troca-de-tela'
  // visual: como a tela PARECE
  | 'neon' | 'grade' | 'vidro' | 'aurora' | 'titulos';

/** Movimento é o que reage; visual é o que muda a aparência parada. */
export type GrupoEfeito = 'movimento' | 'visual';

export const ROTULO_GRUPO: Record<GrupoEfeito, string> = {
  movimento: 'Movimento',
  visual: 'Visual',
};

export interface Efeito {
  id: IdEfeito;
  grupo: GrupoEfeito;
  nome: string;
  /** o que a pessoa vai ver, em uma linha */
  descricao: string;
  /** ligado numa instalação nova */
  padrao: boolean;
}

export const EFEITOS: readonly Efeito[] = [
  {
    id: 'relevo',
    grupo: 'movimento',
    nome: 'Cartões com relevo',
    descricao: 'O cartão sob o cursor sobe um pouco e ganha sombra.',
    padrao: true,
  },
  {
    id: 'foco-vivo',
    grupo: 'movimento',
    nome: 'Realce do que está em foco',
    descricao: 'A linha sob o cursor e o campo em edição ficam destacados.',
    padrao: true,
  },
  {
    id: 'cascata',
    grupo: 'movimento',
    nome: 'Listas em cascata',
    descricao: 'Os itens da lista aparecem um após o outro, não todos de uma vez.',
    padrao: true,
  },
  {
    id: 'respiro',
    grupo: 'movimento',
    nome: 'Fundo com respiro',
    descricao: 'Um brilho muito lento no fundo, para a tela não ficar parada.',
    padrao: false,
  },
  {
    id: 'troca-de-tela',
    grupo: 'movimento',
    nome: 'Transição entre telas',
    descricao: 'Ao trocar de tela, a nova entra deslizando em vez de piscar.',
    padrao: true,
  },

  /* ─── visual: mudam a aparência, mesmo com a tela parada ─── */
  {
    id: 'neon',
    grupo: 'visual',
    nome: 'Linhas de neon',
    descricao: 'Botão, campo em foco e menu aceso ganham um contorno luminoso.',
    padrao: false,
  },
  {
    id: 'grade',
    grupo: 'visual',
    nome: 'Grade no fundo',
    descricao: 'Uma malha fina atrás do conteúdo, como papel milimetrado.',
    padrao: false,
  },
  {
    id: 'vidro',
    grupo: 'visual',
    nome: 'Vidro fosco',
    descricao: 'Cartões e janelas ficam translúcidos, com o fundo desfocado.',
    padrao: false,
  },
  {
    id: 'aurora',
    grupo: 'visual',
    nome: 'Aurora no fundo',
    descricao: 'Dois clarões de cor nos cantos, bem apagados, atrás de tudo.',
    padrao: false,
  },
  {
    id: 'titulos',
    grupo: 'visual',
    nome: 'Títulos em degradê',
    descricao: 'Os títulos grandes terminam na cor de destaque.',
    padrao: false,
  },
] as const;

/** Os efeitos de um grupo, na ordem do catálogo. */
export function efeitosDoGrupo(grupo: GrupoEfeito): readonly Efeito[] {
  return EFEITOS.filter((e) => e.grupo === grupo);
}

export function efeitoValido(v: unknown): v is IdEfeito {
  return typeof v === 'string' && EFEITOS.some((e) => e.id === v);
}

/** Os que vêm ligados numa instalação nova. */
export function efeitosPadrao(): IdEfeito[] {
  return EFEITOS.filter((e) => e.padrao).map((e) => e.id);
}

/**
 * Limpa o que veio do armazenamento: descarta id desconhecido (versão antiga
 * ou mexida na mão), tira repetido e devolve sempre na ordem do catálogo,
 * para a classe do <html> não depender da ordem em que foi clicado.
 */
export function normalizarEfeitos(v: unknown): IdEfeito[] {
  if (!Array.isArray(v)) return efeitosPadrao();
  const escolhidos = new Set(v.filter(efeitoValido));
  return EFEITOS.filter((e) => escolhidos.has(e.id)).map((e) => e.id);
}

/** Liga ou desliga um efeito, devolvendo a lista nova (sem mexer na recebida). */
export function alternar(atuais: readonly IdEfeito[], id: IdEfeito): IdEfeito[] {
  const tem = atuais.includes(id);
  return normalizarEfeitos(tem ? atuais.filter((e) => e !== id) : [...atuais, id]);
}

/** Classes para o <html>: `ef-relevo ef-cascata`… */
export function classesDe(efeitos: readonly IdEfeito[]): string {
  return efeitos.map((e) => `ef-${e}`).join(' ');
}

/**
 * Como o <html> deve ficar depois de escolher estes efeitos, partindo das
 * classes que ele tem agora.
 *
 * É função pura de propósito. A versão anterior mexia direto no `classList`,
 * removendo durante um `forEach` -- e `classList` é uma lista VIVA: cada
 * remoção encurtava a lista debaixo do laço e pulava o item seguinte. Com
 * quatro efeitos ligados, dois continuavam colados no <html> depois de
 * desmarcados. Era o "desliguei e não desligou". Montando a lista nova do
 * zero, o erro não tem onde acontecer -- e dá para testar sem navegador.
 */
export function classesDoHtml(atuais: readonly string[], efeitos: readonly IdEfeito[]): string[] {
  const semEfeito = atuais.filter((c) => c && !c.startsWith('ef-'));
  return [...semEfeito, ...efeitos.map((e) => `ef-${e}`)];
}
