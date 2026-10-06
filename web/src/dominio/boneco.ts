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

export interface Cena {
  id: string;
  nome: string;
  aparelho: Aparelho;
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
    id: 'agachamento', nome: 'Agachamento', aparelho: 'barra', presoEm: 'ombros',
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
    id: 'rosca', nome: 'Rosca direta', aparelho: 'halteres', presoEm: 'maos',
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
    id: 'desenvolvimento', nome: 'Desenvolvimento', aparelho: 'barra', presoEm: 'maos',
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
    // Remada ALTA, não curvada: de frente, a curvada viraria um boneco tombado
    // de lado. Aqui a barra sobe rente ao corpo até o queixo, com o cotovelo
    // indo para cima e para fora — que é o que se vê de frente.
    id: 'remada', nome: 'Remada alta', aparelho: 'barra', presoEm: 'maos',
    cicloMs: 1600, repeticoes: 4,
    quadros: [
      frente({ ombro: 7, cotovelo: 5 }),
      frente({ ombro: 46, cotovelo: 66 }),
      frente({ ombro: 96, cotovelo: 116 }),
      frente({ ombro: 44, cotovelo: 62 }),
      frente({ ombro: 7, cotovelo: 5 }),
    ],
  },
  {
    // Terra: braço reto o tempo todo — braço dobrado em terra é erro de
    // academia. De frente é o joelho e o quadril que contam a história.
    id: 'terra', nome: 'Levantamento terra', aparelho: 'barra', presoEm: 'maos',
    cicloMs: 2200, repeticoes: 3,
    quadros: [
      frente({ ombro: 5, cotovelo: 3, coxa: 5, joelho: -3 }),
      frente({ ombro: 9, cotovelo: 2, coxa: 24, joelho: -24 }, { quadril: 2 }),
      frente({ ombro: 13, cotovelo: 2, coxa: 44, joelho: -44 }, { quadril: 4, tronco: 2 }),
      frente({ ombro: 9, cotovelo: 2, coxa: 22, joelho: -22 }, { quadril: 2 }),
      frente({ ombro: 5, cotovelo: 3, coxa: 5, joelho: -3 }),
    ],
  },
  {
    // Elevação lateral: braço quase ESTICADO subindo até a horizontal. Cotovelo
    // dobrado em 90 faria uma trave de gol, não uma elevação.
    id: 'elevacao', nome: 'Elevação lateral', aparelho: 'halteres', presoEm: 'maos',
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
    // Tríceps: o braço fica QUIETO apontando para cima e só o antebraço cai
    // atrás da cabeça. É o cotovelo parado que faz o exercício ser tríceps.
    id: 'triceps', nome: 'Tríceps francês', aparelho: 'halteres', presoEm: 'maos',
    cicloMs: 1700, repeticoes: 5,
    quadros: [
      frente({ ombro: 171, cotovelo: 5 }),
      frente({ ombro: 170, cotovelo: -78 }),
      frente({ ombro: 169, cotovelo: -148 }, { cabeca: 4 }),
      frente({ ombro: 170, cotovelo: -74 }),
      frente({ ombro: 171, cotovelo: 5 }),
    ],
  },
  {
    id: 'panturrilha', nome: 'Panturrilha', aparelho: 'halteres', presoEm: 'maos',
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
    id: 'polichinelo', nome: 'Polichinelo', aparelho: 'nenhum', presoEm: 'chao',
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
    id: 'corda', nome: 'Pular corda', aparelho: 'corda', presoEm: 'maos',
    cicloMs: 760, repeticoes: 10,
    quadros: [
      frente({ ombro: 20, cotovelo: 72, coxa: 4, joelho: -6 }),
      frente({ ombro: 24, cotovelo: 78, coxa: 10, joelho: -18 }, { voo: 4.0 }),
      frente({ ombro: 20, cotovelo: 72, coxa: 4, joelho: -6 }),
    ],
  },
  {
    // Corrida de frente: um joelho sobe enquanto o outro desce, e o braço
    // oposto acompanha. Vem escrito porque aqui a assimetria É o exercício.
    id: 'corrida', nome: 'Corrida no lugar', aparelho: 'nenhum', presoEm: 'chao',
    cicloMs: 700, repeticoes: 10,
    quadros: [
      { ...EM_PE, ombroE: 30, cotoveloE: 96, ombroD: -16, cotoveloD: -60, coxaE: 14, joelhoE: -6, coxaD: -40, joelhoD: 78 },
      { ...EM_PE, ombroE: 16, cotoveloE: 60, ombroD: -30, cotoveloD: -96, coxaE: 40, joelhoE: -78, coxaD: -14, joelhoD: 6 },
      { ...EM_PE, ombroE: 30, cotoveloE: 96, ombroD: -16, cotoveloD: -60, coxaE: 14, joelhoE: -6, coxaD: -40, joelhoD: 78 },
    ],
  },
  {
    // Avanço de frente: uma perna abre e dobra, a outra fica atrás com o
    // calcanhar levantado. Os braços só penduram com o peso.
    id: 'afundo', nome: 'Avanço', aparelho: 'halteres', presoEm: 'maos',
    cicloMs: 2000, repeticoes: 4,
    quadros: [
      frente({ ombro: 10, cotovelo: 6, coxa: 5, joelho: -3 }),
      frente({ ombro: 11, cotovelo: 6 }, { quadril: 5, coxaE: 34, joelhoE: -34, coxaD: -22, joelhoD: 44 }),
      frente({ ombro: 10, cotovelo: 6, coxa: 5, joelho: -3 }),
    ],
  },

  /* ─── as pausas: é o que faz parecer gente, não motor ─── */
  {
    id: 'descanso', nome: 'Descansando', aparelho: 'nenhum', presoEm: 'chao',
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
    id: 'agua', nome: 'Bebendo água', aparelho: 'garrafa', presoEm: 'maos',
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
    id: 'celular', nome: 'Olhando o celular', aparelho: 'celular', presoEm: 'maos',
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
 * Suaviza a entrada e a saída de cada quadro. O cosseno sobe e desce com
 * derivada zero nas pontas, então a emenda entre dois quadros não tem o
 * tranco que a parábola de antes deixava passar.
 */
const suave = (t: number) => (1 - Math.cos(Math.PI * Math.min(Math.max(t, 0), 1))) / 2;

const entre = (a: number, b: number, t: number) => a + (b - a) * t;

/** Pose de uma lista de quadros no instante `t` (0 a 1). */
export function poseDosQuadros(quadros: readonly Pose[], t: number): Pose {
  const total = quadros.length - 1;
  const pos = Math.min(Math.max(t, 0), 1) * total;
  // o corte antigo (0.999999) fazia t=1 parar um fio antes do último quadro
  const i = Math.min(Math.floor(pos), total - 1);
  const f = suave(pos - i);
  const a = quadros[i];
  const b = quadros[Math.min(i + 1, total)];

  const saida = {} as Pose;
  for (const chave of Object.keys(EM_PE) as Array<keyof Pose>) {
    saida[chave] = entre(a[chave], b[chave], f);
  }
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

/** Ângulo 0 aponta para baixo; positivo gira para a direita da tela. */
function desloca(p: Ponto, grau: number, tamanho: number): Ponto {
  const r = (grau * Math.PI) / 180;
  return { x: p.x + Math.sin(r) * tamanho, y: p.y + Math.cos(r) * tamanho };
}

/** Converte os ângulos em pontos para desenhar. */
export function esqueletoDe(p: Pose, base: Ponto = { x: 32, y: 30 }): Esqueleto {
  const quadril = { x: base.x, y: base.y + p.quadril };
  const ombro = desloca(quadril, 180 + p.tronco, TAMANHO.tronco);
  const cabeca = desloca(ombro, 180 + p.tronco + p.cabeca, TAMANHO.pescoco);

  // a linha dos ombros acompanha a inclinação do tronco (90° à frente dele)
  const giro = ((p.tronco + 90) * Math.PI) / 180;
  const ox = Math.sin(giro) * MEIO_OMBROS;
  const oy = Math.cos(giro) * MEIO_OMBROS;
  const ombroE = { x: ombro.x + ox, y: ombro.y + oy };
  const ombroD = { x: ombro.x - ox, y: ombro.y - oy };
  const quadrilE = { x: quadril.x + MEIO_QUADRIL, y: quadril.y };
  const quadrilD = { x: quadril.x - MEIO_QUADRIL, y: quadril.y };

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
