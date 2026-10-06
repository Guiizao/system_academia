/**
 * O bonequinho da academia: esqueleto articulado, não figura rígida.
 *
 * Cada junta tem ângulo próprio (ombro, cotovelo, quadril, joelho), a pose é
 * interpolada quadro a quadro e as pontas chegam ATRASADAS em relação à raiz
 * — é esse atraso que faz o braço parecer solto em vez de um graveto.
 *
 * ─── Como ler os ângulos ───────────────────────────────────────────
 * 0° aponta para BAIXO, 90° para a direita da tela, 180° para cima.
 * O ângulo do cotovelo é RELATIVO ao braço, e o do joelho à coxa: o
 * antebraço é desenhado em `ombro + cotovelo`.
 *
 * ─── Ele trabalha SEMPRE de frente ─────────────────────────────────
 * De frente dá para ver o exercício. De perfil um braço cobre o outro, o
 * desenho vira um risco só e as juntas aparecem uma dentro da outra. Então
 * aqui não existe pose de perfil: o lado direito é o espelho do esquerdo, e
 * `frente()` é o único construtor de pose.
 *
 * Duas consequências que valem como regra:
 *
 *   1. `tronco` quase não é usado. Neste modelo de duas dimensões, inclinar o
 *      tronco gira os ombros DENTRO do plano da tela: de frente aquilo não lê
 *      como "curvar para a frente", lê como tombar de lado. Por isso os
 *      exercícios de dobradiça de quadril aparecem na versão que o olho
 *      entende de frente — a remada é ALTA, e o terra mostra a barra descendo
 *      com o joelho dobrando.
 *
 *   2. Ombro e quadril têm LARGURA (ver `MEIO_OMBROS` e `MEIO_QUADRIL`).
 *      Quando os dois braços nasciam do mesmo ponto, com o boneco quase
 *      parado o braço esquerdo, o direito e o tronco caíam na mesma reta e as
 *      juntas empilhavam umas dentro das outras — o borrão que dava para ver
 *      no canto da tela.
 */

export interface Pose {
  /** quanto o quadril sobe (-) ou desce (+), em unidades do desenho */
  quadril: number;
  /** altura do corpo inteiro acima do chão; só salto usa (polichinelo, corda) */
  voo: number;
  /** inclinação do tronco: de frente, só um balanço de poucos graus */
  tronco: number;
  cabeca: number;
  ombroE: number; cotoveloE: number;
  ombroD: number; cotoveloD: number;
  coxaE: number; joelhoE: number;
  coxaD: number; joelhoD: number;
}

export type Aparelho = 'barra' | 'halteres' | 'nenhum' | 'garrafa' | 'celular' | 'corda';

/** De que ângulo a câmera olha este exercício. */
export type Vista = 'frente' | 'lado';

export interface Cena {
  id: string;
  nome: string;
  aparelho: Aparelho;
  vista: Vista;
  /** onde o aparelho fica: 'maos' acompanha as mãos, 'ombros' nas costas, 'chao' parado */
  presoEm: 'maos' | 'ombros' | 'chao';
  /** um ciclo do movimento, em ms */
  cicloMs: number;
  /** quantas repetições antes de trocar de cena */
  repeticoes: number;
  quadros: Pose[];
}

const EM_PE: Pose = {
  quadril: 0, voo: 0, tronco: 0, cabeca: 0,
  ombroE: 8, cotoveloE: 4, ombroD: -8, cotoveloD: -4,
  coxaE: 6, joelhoE: 2, coxaD: -6, joelhoD: -2,
};

/** Um lado só: o outro sai espelhado. */
type Meio = { ombro?: number; cotovelo?: number; coxa?: number; joelho?: number };

/**
 * Monta a pose de frente. O lado direito é o espelho do esquerdo, que é o que
 * faz o exercício ser legível: os dois braços sobem juntos, os dois joelhos
 * dobram juntos. Quando o movimento é mesmo assimétrico — correr, avançar,
 * levar a garrafa à boca — o lado de fora vem escrito em `resto`.
 */
function frente(m: Meio = {}, resto: Partial<Pose> = {}): Pose {
  const { ombro = 8, cotovelo = 4, coxa = 6, joelho = 2 } = m;
  return {
    ...EM_PE,
    ombroE: ombro, cotoveloE: cotovelo, ombroD: -ombro, cotoveloD: -cotovelo,
    coxaE: coxa, joelhoE: joelho, coxaD: -coxa, joelhoD: -joelho,
    ...resto,
  };
}

/**
 * Pose de PERFIL, para quando a câmera gira. Aqui os dois braços fazem o mesmo
 * movimento — espelhar, de lado, mandaria um para a frente e o outro para trás,
 * e o boneco pareceria fazer dois exercícios ao mesmo tempo. O membro de trás
 * sai alguns graus atrasado, só para o olho separar os dois.
 *
 * De perfil o boneco olha para a ESQUERDA da tela (`tronco` positivo joga os
 * ombros para -x). Daí as duas regras de sinal: cotovelo NEGATIVO dobra o
 * braço (a mão sobe pela frente) e joelho POSITIVO dobra a perna (o calcanhar
 * vai para trás).
 */
function lado(m: Meio = {}, resto: Partial<Pose> = {}): Pose {
  const { ombro = 6, cotovelo = -8, coxa = 4, joelho = 4 } = m;
  return {
    ...EM_PE,
    ombroE: ombro, cotoveloE: cotovelo,
    ombroD: ombro - 9, cotoveloD: cotovelo + 6,
    coxaE: coxa, joelhoE: joelho,
    coxaD: coxa - 7, joelhoD: joelho + 4,
    ...resto,
  };
}

/** Em pé, parado, braços soltos. Começo e fim de toda busca de aparelho. */
export const PARADO: Pose = frente({ ombro: 9, cotovelo: 5 });

/**
 * Buscar o aparelho. Entre um exercício e outro ele agacha, pega o que está
 * no chão e levanta com aquilo na mão — em vez de o peso simplesmente
 * aparecer do nada. Agachar, e não curvar: de frente, curvar leria como tombo.
 *
 * `MOMENTO_DA_PEGADA` é o instante em que a mão encosta no aparelho: antes
 * disso o desenho põe o aparelho no chão, depois põe na mão.
 */
export const PEGAR: readonly Pose[] = [
  PARADO,
  frente({ ombro: 14, cotovelo: 8, coxa: 30, joelho: -30 }),
  frente({ ombro: 11, cotovelo: 5, coxa: 62, joelho: -62 }),   // agachado, mão no aparelho
  frente({ ombro: 12, cotovelo: 7, coxa: 50, joelho: -50 }),   // pegou, começa a subir
  frente({ ombro: 12, cotovelo: 8, coxa: 20, joelho: -20 }),
  PARADO,
];
export const MS_PEGAR = 1500;
export const MOMENTO_DA_PEGADA = 0.42;

/**
 * 12 exercícios + as pausas. A ordem conta uma sessão de treino: pega o
 * aparelho, faz a série, descansa, bebe água, mexe no celular.
 *
 * Os ciclos ganharam um quadro no meio da subida e outro no meio da descida.
 * Com três quadros só (embaixo, em cima, embaixo) o movimento ia e voltava
 * pelo mesmo caminho e tinha cara de pêndulo; com cinco dá para a descida ser
 * mais demorada que a subida, que é como uma série de verdade se parece.
 */
export const CENAS: readonly Cena[] = [
  {
    // Agachamento: a barra atravessa os ombros e as mãos a seguram por fora,
    // com o cotovelo apontando para baixo.
    id: 'agachamento', nome: 'Agachamento', aparelho: 'barra', vista: 'frente', presoEm: 'ombros',
    cicloMs: 2000, repeticoes: 4,
    quadros: [
      frente({ ombro: 140, cotovelo: -100, coxa: 8, joelho: -6 }),
      frente({ ombro: 139, cotovelo: -97, coxa: 30, joelho: -30 }),
      frente({ ombro: 138, cotovelo: -94, coxa: 50, joelho: -50 }, { tronco: 3 }),
      frente({ ombro: 139, cotovelo: -97, coxa: 26, joelho: -26 }),
      frente({ ombro: 140, cotovelo: -100, coxa: 8, joelho: -6 }),
    ],
  },
  {
    // Rosca: o ombro fica PARADO e só o cotovelo fecha, até a mão chegar na
    // altura do ombro. Ombro que sobe junto vira arremesso, não rosca.
    id: 'rosca', nome: 'Rosca direta', aparelho: 'halteres', vista: 'frente', presoEm: 'maos',
    cicloMs: 1500, repeticoes: 5,
    quadros: [
      frente({ ombro: 10, cotovelo: 6 }),
      frente({ ombro: 10, cotovelo: 84 }),
      frente({ ombro: 10, cotovelo: 150 }),
      frente({ ombro: 10, cotovelo: 70 }),
      frente({ ombro: 10, cotovelo: 6 }),
    ],
  },
  {
    // Desenvolvimento: embaixo a barra fica na altura do queixo com o cotovelo
    // aberto; em cima os braços esticam quase juntos sobre a cabeça.
    id: 'desenvolvimento', nome: 'Desenvolvimento', aparelho: 'barra', vista: 'frente', presoEm: 'maos',
    cicloMs: 1800, repeticoes: 4,
    quadros: [
      frente({ ombro: 66, cotovelo: 82 }),
      frente({ ombro: 120, cotovelo: 48 }),
      frente({ ombro: 171, cotovelo: 5 }),
      frente({ ombro: 118, cotovelo: 50 }),
      frente({ ombro: 66, cotovelo: 82 }),
    ],
  },
  {
    // Remada CURVADA, de perfil: é o ângulo em que a dobradiça de quadril
    // aparece. De frente ela precisaria do tronco inclinado, que neste desenho
    // leria como tombar de lado -- foi por isso que ela tinha virado remada alta.
    id: 'remada', nome: 'Remada curvada', aparelho: 'barra', vista: 'lado', presoEm: 'maos',
    cicloMs: 1800, repeticoes: 4,
    quadros: [
      lado({ ombro: 5, cotovelo: -8, coxa: 12, joelho: 14 }, { tronco: 56, quadril: 2 }),
      lado({ ombro: 64, cotovelo: -80, coxa: 12, joelho: 14 }, { tronco: 55, quadril: 2 }),
      lado({ ombro: 118, cotovelo: -148, coxa: 12, joelho: 14 }, { tronco: 54, quadril: 2 }),
      lado({ ombro: 60, cotovelo: -76, coxa: 12, joelho: 14 }, { tronco: 55, quadril: 2 }),
      lado({ ombro: 5, cotovelo: -8, coxa: 12, joelho: 14 }, { tronco: 56, quadril: 2 }),
    ],
  },
  {
    // Terra, de perfil: o quadril vai para TRÁS, a canela fica quase em pé e o
    // braço não dobra -- braço dobrado em terra é erro de academia. De frente
    // isto virava um agachamento de braço esticado.
    id: 'terra', nome: 'Levantamento terra', aparelho: 'barra', vista: 'lado', presoEm: 'maos',
    cicloMs: 2400, repeticoes: 3,
    quadros: [
      lado({ ombro: 3, cotovelo: -4, coxa: 2, joelho: 2 }, { tronco: 3 }),
      lado({ ombro: 2, cotovelo: -4, coxa: 15, joelho: -11 }, { tronco: 32, quadril: 2 }),
      lado({ ombro: 1, cotovelo: -3, coxa: 26, joelho: -20 }, { tronco: 58, quadril: 4 }),
      lado({ ombro: 2, cotovelo: -4, coxa: 13, joelho: -9 }, { tronco: 30, quadril: 2 }),
      lado({ ombro: 3, cotovelo: -4, coxa: 2, joelho: 2 }, { tronco: 3 }),
    ],
  },
  {
    // Elevação lateral: braço quase ESTICADO subindo até a horizontal. Cotovelo
    // dobrado em 90 faria uma trave de gol, não uma elevação.
    id: 'elevacao', nome: 'Elevação lateral', aparelho: 'halteres', vista: 'frente', presoEm: 'maos',
    cicloMs: 1700, repeticoes: 4,
    quadros: [
      frente({ ombro: 14, cotovelo: 8 }),
      frente({ ombro: 52, cotovelo: 12 }),
      frente({ ombro: 88, cotovelo: 14 }),
      frente({ ombro: 48, cotovelo: 12 }),
      frente({ ombro: 14, cotovelo: 8 }),
    ],
  },
  {
    // Tríceps francês, de perfil: o braço fica QUIETO apontando para cima e o
    // antebraço cai atrás da cabeça. De frente não dava para ver que ele cai
    // para TRÁS -- parecia abrir para os lados.
    id: 'triceps', nome: 'Tríceps francês', aparelho: 'halteres', vista: 'lado', presoEm: 'maos',
    cicloMs: 1800, repeticoes: 5,
    quadros: [
      lado({ ombro: 172, cotovelo: -6 }),
      lado({ ombro: 171, cotovelo: -76 }),
      lado({ ombro: 170, cotovelo: -142 }, { cabeca: 4 }),
      lado({ ombro: 171, cotovelo: -72 }),
      lado({ ombro: 172, cotovelo: -6 }),
    ],
  },
  {
    id: 'panturrilha', nome: 'Panturrilha', aparelho: 'halteres', vista: 'frente', presoEm: 'maos',
    cicloMs: 1200, repeticoes: 7,
    quadros: [
      frente({ ombro: 10, cotovelo: 6 }),
      frente({ ombro: 10, cotovelo: 6, coxa: 5, joelho: -1 }, { voo: 2.6 }),
      frente({ ombro: 10, cotovelo: 6 }),
    ],
  },
  {
    // Polichinelo: braços e pernas abrem juntos. O joelho acompanha a coxa
    // para a canela ficar em pé e os pés não cruzarem um no outro.
    id: 'polichinelo', nome: 'Polichinelo', aparelho: 'nenhum', vista: 'frente', presoEm: 'chao',
    cicloMs: 820, repeticoes: 8,
    quadros: [
      frente({ ombro: 6, cotovelo: 4, coxa: 4, joelho: -2 }),
      frente({ ombro: 156, cotovelo: 8, coxa: 26, joelho: -24 }, { voo: 3.2 }),
      frente({ ombro: 6, cotovelo: 4, coxa: 4, joelho: -2 }),
    ],
  },
  {
    // Corda: braço colado no corpo, antebraço para fora, e quem gira é o
    // punho. A corda em si é desenhada no componente, girando com o ciclo.
    id: 'corda', nome: 'Pular corda', aparelho: 'corda', vista: 'frente', presoEm: 'maos',
    cicloMs: 760, repeticoes: 10,
    quadros: [
      frente({ ombro: 20, cotovelo: 72, coxa: 4, joelho: -6 }),
      frente({ ombro: 24, cotovelo: 78, coxa: 10, joelho: -18 }, { voo: 4.0 }),
      frente({ ombro: 20, cotovelo: 72, coxa: 4, joelho: -6 }),
    ],
  },
  {
    // Corrida, de perfil: é a única cena em que os braços fazem coisas opostas
    // de verdade -- braço e perna cruzados, como na corrida mesmo.
    id: 'corrida', nome: 'Corrida no lugar', aparelho: 'nenhum', vista: 'lado', presoEm: 'chao',
    cicloMs: 700, repeticoes: 10,
    quadros: [
      { ...EM_PE, tronco: 6, ombroE: -44, cotoveloE: -88, ombroD: 40, cotoveloD: -70, coxaE: -42, joelhoE: 62, coxaD: 24, joelhoD: 18 },
      { ...EM_PE, tronco: 6, ombroE: 40, cotoveloE: -70, ombroD: -44, cotoveloD: -88, coxaE: 24, joelhoE: 18, coxaD: -42, joelhoD: 62 },
      { ...EM_PE, tronco: 6, ombroE: -44, cotoveloE: -88, ombroD: 40, cotoveloD: -70, coxaE: -42, joelhoE: 62, coxaD: 24, joelhoD: 18 },
    ],
  },
  {
    // Avanço, de perfil: uma perna vai para a FRENTE e dobra em 90, a outra
    // fica atrás com o calcanhar levantado. De frente as duas pernas apareciam
    // só abrindo para os lados, que é outro exercício.
    id: 'afundo', nome: 'Avanço', aparelho: 'halteres', vista: 'lado', presoEm: 'maos',
    cicloMs: 2200, repeticoes: 4,
    quadros: [
      lado({ ombro: 6, cotovelo: -6, coxa: 3, joelho: 2 }),
      lado({ ombro: 7, cotovelo: -7 }, { quadril: 3, tronco: 4, coxaE: -20, joelhoE: 22, coxaD: 16, joelhoD: 18 }),
      lado({ ombro: 7, cotovelo: -7 }, { quadril: 6, tronco: 6, coxaE: -36, joelhoE: 38, coxaD: 30, joelhoD: 34 }),
      lado({ ombro: 7, cotovelo: -7 }, { quadril: 3, tronco: 4, coxaE: -18, joelhoE: 20, coxaD: 14, joelhoD: 16 }),
      lado({ ombro: 6, cotovelo: -6, coxa: 3, joelho: 2 }),
    ],
  },

  /* ─── as pausas: é o que faz parecer gente, não motor ─── */
  {
    id: 'descanso', nome: 'Descansando', aparelho: 'nenhum', vista: 'frente', presoEm: 'chao',
    cicloMs: 2800, repeticoes: 1,
    quadros: [
      frente({ ombro: 13, cotovelo: 20 }),
      frente({ ombro: 10, cotovelo: 16 }, { quadril: -1, cabeca: -3 }),
      frente({ ombro: 13, cotovelo: 20 }),
    ],
  },
  {
    // Só UMA mão sobe com a garrafa; a outra fica solta. Por isso o lado
    // direito vem escrito, em vez de sair espelhado.
    id: 'agua', nome: 'Bebendo água', aparelho: 'garrafa', vista: 'frente', presoEm: 'maos',
    cicloMs: 2800, repeticoes: 1,
    quadros: [
      frente({ ombro: 11, cotovelo: 8 }),
      frente({ ombro: 11, cotovelo: 8 }, { ombroD: -30, cotoveloD: -118, cabeca: -8 }),
      frente({ ombro: 11, cotovelo: 8 }, { ombroD: -26, cotoveloD: -142, cabeca: -16 }),
      frente({ ombro: 11, cotovelo: 8 }),
    ],
  },
  {
    // As duas mãos seguram o celular na frente do corpo e a cabeça desce.
    id: 'celular', nome: 'Olhando o celular', aparelho: 'celular', vista: 'frente', presoEm: 'maos',
    cicloMs: 3200, repeticoes: 1,
    quadros: [
      frente({ ombro: 26, cotovelo: 96 }, { cabeca: 14 }),
      frente({ ombro: 28, cotovelo: 102 }, { cabeca: 16 }),
      frente({ ombro: 26, cotovelo: 96 }, { cabeca: 14 }),
    ],
  },
] as const;

const PAUSAS = ['descanso', 'agua', 'celular'];
export const EXERCICIOS = CENAS.filter((c) => !PAUSAS.includes(c.id));

/**
 * Interpolação Catmull-Rom entre os quadros.
 *
 * A versão anterior suavizava CADA TRECHO separado (cosseno de 0 a 1 entre um
 * quadro e o seguinte). Com cinco quadros por ciclo isso fazia a velocidade
 * cair a zero cinco vezes por repetição: o movimento parava, arrancava, parava
 * -- era a animação "travada", e não falta de quadros por segundo.
 *
 * Catmull-Rom olha os quadros VIZINHOS para calcular a inclinação em cada
 * ponto, então a curva passa pelos quadros sem perder velocidade no caminho.
 * Ela ainda desacelera sozinha onde o movimento realmente vira (o fundo do
 * agachamento, o topo da rosca), porque ali os vizinhos estão dos dois lados.
 *
 * Os índices dão a volta: como o último quadro é igual ao primeiro, a emenda
 * do fim para o começo fica tão lisa quanto o meio.
 */
function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1
    + (p2 - p0) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (3 * p1 - 3 * p2 + p3 - p0) * t3
  );
}

/** Pose de uma lista de quadros no instante `t` (0 a 1). */
export function poseDosQuadros(quadros: readonly Pose[], t: number): Pose {
  const distintos = quadros.length - 1;        // o último repete o primeiro
  if (distintos < 1) return { ...quadros[0] };

  const pos = Math.min(Math.max(t, 0), 1) * distintos;
  const i = Math.min(Math.floor(pos), distintos - 1);
  const f = pos - i;
  const nos = (k: number) => quadros[((k % distintos) + distintos) % distintos];
  const [a, b, c, d] = [nos(i - 1), nos(i), nos(i + 1), nos(i + 2)];

  const saida = {} as Pose;
  for (const chave of Object.keys(EM_PE) as Array<keyof Pose>) {
    saida[chave] = catmull(a[chave], b[chave], c[chave], d[chave], f);
  }
  // em t=0 e t=1 a conta tem de devolver o quadro exato, sem arredondar por fora
  if (pos === 0) return { ...quadros[0] };
  if (pos === distintos) return { ...quadros[distintos] };
  return saida;
}

/** Pose da cena no instante `t` (0 a 1 dentro do ciclo). */
export function poseNoTempo(cena: Cena, t: number): Pose {
  return poseDosQuadros(cena.quadros, t);
}

/**
 * Atraso das pontas: antebraço e canela perseguem o alvo com folga, então
 * chegam depois do ombro e do quadril. É o que tira a cara de boneco de pau.
 */
export function comAtraso(atual: Pose, alvo: Pose, forca = 0.18, msDoQuadro = 1000 / 60): Pose {
  // Sem corrigir pelo tempo, o mesmo fator rende perseguições diferentes: num
  // monitor de 144Hz cabem 14 quadros em 100ms contra 6 num de 60Hz, e o braço
  // chegava quase sem atraso. Aqui a força passa a valer "por 1/60 de segundo".
  const passos = Math.max(0, msDoQuadro) / (1000 / 60);
  const fator = passos === 0 ? 0 : 1 - (1 - Math.min(1, Math.max(0, forca))) ** passos;
  const puxa = (de: number, para: number) => de + (para - de) * fator;
  return {
    ...alvo,
    cotoveloE: puxa(atual.cotoveloE, alvo.cotoveloE),
    cotoveloD: puxa(atual.cotoveloD, alvo.cotoveloD),
    joelhoE: puxa(atual.joelhoE, alvo.joelhoE),
    joelhoD: puxa(atual.joelhoD, alvo.joelhoD),
    cabeca: puxa(atual.cabeca, alvo.cabeca),
  };
}

export interface Ponto { x: number; y: number }
export interface Esqueleto {
  quadril: Ponto; ombro: Ponto; cabeca: Ponto;
  /** pontas da linha dos ombros e do quadril: é de onde os membros saem */
  ombroE: Ponto; ombroD: Ponto; quadrilE: Ponto; quadrilD: Ponto;
  cotoveloE: Ponto; maoE: Ponto; cotoveloD: Ponto; maoD: Ponto;
  joelhoE: Ponto; peE: Ponto; joelhoD: Ponto; peD: Ponto;
}

const TAMANHO = { tronco: 13, braco: 7, antebraco: 7, coxa: 8, canela: 8, pescoco: 4.6 };
/** Meia largura dos ombros e do quadril, em unidades do desenho. */
const MEIO_OMBROS = 2.8;
const MEIO_QUADRIL = 2;

/** Quanto da largura do corpo se vê em cada vista. De lado, quase nada. */
export const LARGURA_DA_VISTA: Record<Vista, number> = { frente: 1, lado: 0.3 };

/** Ângulo 0 aponta para baixo; positivo gira para a direita da tela. */
function desloca(p: Ponto, grau: number, tamanho: number): Ponto {
  const r = (grau * Math.PI) / 180;
  return { x: p.x + Math.sin(r) * tamanho, y: p.y + Math.cos(r) * tamanho };
}

/**
 * Converte os ângulos em pontos para desenhar.
 *
 * `larguraDoCorpo` encolhe a linha dos ombros e a do quadril quando a câmera
 * está de lado: de perfil o ombro aponta para quem olha, então desenhá-lo na
 * largura cheia faria o boneco parecer de três quartos, não de lado.
 */
export function esqueletoDe(p: Pose, base: Ponto = { x: 32, y: 30 }, larguraDoCorpo = 1): Esqueleto {
  const quadril = { x: base.x, y: base.y + p.quadril };
  const ombro = desloca(quadril, 180 + p.tronco, TAMANHO.tronco);
  const cabeca = desloca(ombro, 180 + p.tronco + p.cabeca, TAMANHO.pescoco);

  // a linha dos ombros acompanha a inclinação do tronco (90° à frente dele)
  const giro = ((p.tronco + 90) * Math.PI) / 180;
  const ox = Math.sin(giro) * MEIO_OMBROS * larguraDoCorpo;
  const oy = Math.cos(giro) * MEIO_OMBROS * larguraDoCorpo;
  const ombroE = { x: ombro.x + ox, y: ombro.y + oy };
  const ombroD = { x: ombro.x - ox, y: ombro.y - oy };
  const meioQuadril = MEIO_QUADRIL * larguraDoCorpo;
  const quadrilE = { x: quadril.x + meioQuadril, y: quadril.y };
  const quadrilD = { x: quadril.x - meioQuadril, y: quadril.y };

  const cotoveloE = desloca(ombroE, p.ombroE, TAMANHO.braco);
  const maoE = desloca(cotoveloE, p.ombroE + p.cotoveloE, TAMANHO.antebraco);
  const cotoveloD = desloca(ombroD, p.ombroD, TAMANHO.braco);
  const maoD = desloca(cotoveloD, p.ombroD + p.cotoveloD, TAMANHO.antebraco);

  const joelhoE = desloca(quadrilE, p.coxaE, TAMANHO.coxa);
  const peE = desloca(joelhoE, p.coxaE + p.joelhoE, TAMANHO.canela);
  const joelhoD = desloca(quadrilD, p.coxaD, TAMANHO.coxa);
  const peD = desloca(joelhoD, p.coxaD + p.joelhoD, TAMANHO.canela);

  return {
    quadril, ombro, cabeca, ombroE, ombroD, quadrilE, quadrilD,
    cotoveloE, maoE, cotoveloD, maoD, joelhoE, peE, joelhoD, peD,
  };
}

/** Onde o chão é desenhado. O componente usa o mesmo número na linha. */
export const CHAO_Y = 46.2;

/**
 * Altura em que o aparelho espera, e a do suporte embaixo dele.
 *
 * Não é no piso de propósito: de frente o boneco não encosta no chão sem
 * curvar o tronco, e curvar, neste desenho de duas dimensões, leria como
 * tombar de lado. Com braço de 14 e tronco de 13, agachado fundo a mão chega
 * a uns 11 do piso -- então o peso descansa num suporte baixo, que é onde
 * halter de academia fica mesmo.
 */
export const ALTURA_DO_APARELHO = CHAO_Y - 10.8;
export const ALTURA_DO_SUPORTE = CHAO_Y - 8.4;
export const MEIA_LARGURA_DO_SUPORTE = 9;

/**
 * Planta o boneco no chão.
 *
 * Este era o defeito que fazia tudo parecer errado: o desenho pendurava o
 * corpo pelo QUADRIL, numa altura fixa, e deduzia os pés a partir dos ângulos.
 * Como a perna encurta ao dobrar, agachar levantava os pés -- o boneco agachava
 * no ar enquanto a linha do chão continuava parada embaixo dele.
 *
 * Agora é o contrário: monta o esqueleto, vê qual pé ficou mais baixo e desce
 * (ou sobe) o corpo inteiro até ele encostar. Como todos os pontos andam juntos,
 * nenhum osso muda de tamanho. `voo` levanta o conjunto do chão, e só o salto usa.
 */
export function assentarNoChao(e: Esqueleto, voo = 0, chaoY = CHAO_Y): Esqueleto {
  const apoio = Math.max(e.peE.y, e.peD.y);
  const dy = chaoY - voo - apoio;
  if (dy === 0) return e;
  const mover = (p: Ponto): Ponto => ({ x: p.x, y: p.y + dy });
  return {
    quadril: mover(e.quadril), ombro: mover(e.ombro), cabeca: mover(e.cabeca),
    ombroE: mover(e.ombroE), ombroD: mover(e.ombroD),
    quadrilE: mover(e.quadrilE), quadrilD: mover(e.quadrilD),
    cotoveloE: mover(e.cotoveloE), maoE: mover(e.maoE),
    cotoveloD: mover(e.cotoveloD), maoD: mover(e.maoD),
    joelhoE: mover(e.joelhoE), peE: mover(e.peE),
    joelhoD: mover(e.joelhoD), peD: mover(e.peD),
  };
}

/**
 * Onde a corda está no instante `t` do pulo: +1 em cima da cabeça, -1 embaixo,
 * passando sob os pés. No começo do ciclo ela vem descendo pela frente; no
 * meio, com o boneco no ar, ela passa por baixo. Antes a corda era um arco
 * parado que atravessava o chão — não girava nunca.
 */
export function faseDaCorda(t: number): number {
  return Math.cos(2 * Math.PI * Math.min(Math.max(t, 0), 1));
}

/**
 * O arco da corda: por onde ela passa e quanto dela se vê.
 *
 * Antes era um arco PARADO que nascia numa mão, mergulhava cinco unidades
 * ABAIXO do chão e morria na outra. Não girava nunca e atravessava o piso —
 * o "a corda não está funcionando".
 *
 * O ponto de controle sai da conta do próprio Bézier: o topo da curva fica em
 * (P0 + 2C + P2) / 4, então C = (4·ápice − P0 − P2) / 2 põe o arco exatamente
 * na altura que se quer. O ápice nunca passa de `CHAO_Y`, por construção.
 *
 * A opacidade cai no meio do giro porque ali a corda está de perfil para quem
 * olha: sem isso ela vira um risco atravessado na barriga.
 */
export function arcoDaCorda(e: Esqueleto, fase: number) {
  const emCima = (Math.min(Math.max(fase, -1), 1) + 1) / 2;   // 0 embaixo, 1 em cima
  const apiceY = CHAO_Y - 0.6 + emCima * ((e.cabeca.y - 7) - (CHAO_Y - 0.6));
  const cx = (e.maoE.x + e.maoD.x) / 2;
  const cy = (4 * apiceY - e.maoE.y - e.maoD.y) / 2;
  return {
    apiceY,
    controle: { x: cx, y: cy },
    d: `M ${e.maoE.x} ${e.maoE.y} Q ${cx} ${cy} ${e.maoD.x} ${e.maoD.y}`,
    opacidade: 0.25 + 0.75 * Math.abs(fase),
  };
}
