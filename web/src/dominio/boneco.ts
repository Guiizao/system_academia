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
 * ─── As duas vistas, e por que isso importa ────────────────────────
 * Antes, TODA cena espelhava o lado direito (`ombroD = -ombroE`). De frente
 * isso está certo: polichinelo e elevação lateral abrem os dois braços juntos.
 * Mas remada, rosca e terra só se leem de PERFIL, e ali espelhar manda um
 * braço para a frente e o outro para trás — o boneco fazia dois exercícios ao
 * mesmo tempo. Era isso que deixava os braços com cara de invertidos.
 *
 * Agora cada cena declara a vista e usa o construtor certo:
 *   `frente(...)` espelha de propósito;
 *   `lado(...)`   manda os dois braços juntos, com o de trás alguns graus
 *                 atrasado só para dar profundidade.
 *
 * De perfil o boneco olha para a ESQUERDA da tela: `tronco` positivo joga os
 * ombros para -x, então inclinar para a frente é inclinar para a esquerda.
 * Daí as duas regras de sinal, que valem para toda cena de perfil:
 *   - cotovelo NEGATIVO dobra o braço (a mão sobe pela frente);
 *   - joelho POSITIVO dobra a perna (o calcanhar vai para trás).
 */

export interface Pose {
  /** quanto o quadril sobe (-) ou desce (+), em unidades do desenho */
  quadril: number;
  /** altura do corpo inteiro acima do chão; só salto usa (polichinelo, corda) */
  voo: number;
  /** inclinação do tronco: 0 em pé, positivo = inclinado para a frente */
  tronco: number;
  cabeca: number;
  ombroE: number; cotoveloE: number;
  ombroD: number; cotoveloD: number;
  coxaE: number; joelhoE: number;
  coxaD: number; joelhoD: number;
}

export type Aparelho = 'barra' | 'halteres' | 'nenhum' | 'garrafa' | 'celular' | 'corda';

/** De frente os dois lados aparecem; de perfil um esconde o outro. */
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

/** Um lado só; o construtor da vista decide o que fazer com o outro. */
type Meio = { ombro?: number; cotovelo?: number; coxa?: number; joelho?: number };

/** Vista de frente: o lado direito é o espelho do esquerdo. */
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
 * Vista de perfil: os dois braços fazem o MESMO movimento. O braço e a perna
 * de trás ficam alguns graus atrás — é o bastante para o olho separar os dois
 * sem parecer que o boneco está se contorcendo.
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

/**
 * 12 exercícios + as pausas. A ordem conta uma sessão de treino: puxa o
 * aparelho, faz a série, descansa, bebe água, mexe no celular, troca.
 */
export const CENAS: readonly Cena[] = [
  {
    // Agachamento de frente: a barra atravessa os ombros e as mãos a seguram
    // por fora, com o cotovelo apontando para baixo. Antes os braços subiam
    // num V acima da cabeça, que é gesto de comemorar, não de agachar.
    id: 'agachamento', nome: 'Agachamento', aparelho: 'barra', vista: 'frente', presoEm: 'ombros',
    cicloMs: 1700, repeticoes: 4,
    quadros: [
      frente({ ombro: 140, cotovelo: -100, coxa: 8, joelho: -6 }),
      frente({ ombro: 138, cotovelo: -94, coxa: 50, joelho: -50 }, { tronco: 10 }),
      frente({ ombro: 140, cotovelo: -100, coxa: 8, joelho: -6 }),
    ],
  },
  {
    // Rosca de frente: a mão sobe até a altura do ombro e fecha PARA DENTRO.
    // Com o cotovelo em 128 o antebraço parava na horizontal e virava
    // espantalho; o fecho de verdade passa dos 150.
    id: 'rosca', nome: 'Rosca direta', aparelho: 'halteres', vista: 'frente', presoEm: 'maos',
    cicloMs: 1300, repeticoes: 5,
    quadros: [
      frente({ ombro: 10, cotovelo: 6 }),
      frente({ ombro: 10, cotovelo: 150 }),
      frente({ ombro: 10, cotovelo: 6 }),
    ],
  },
  {
    // Desenvolvimento: embaixo a barra fica na altura do queixo com o cotovelo
    // aberto; em cima os braços esticam quase juntos sobre a cabeça.
    id: 'desenvolvimento', nome: 'Desenvolvimento', aparelho: 'barra', vista: 'frente', presoEm: 'maos',
    cicloMs: 1600, repeticoes: 4,
    quadros: [
      frente({ ombro: 66, cotovelo: 82 }),
      frente({ ombro: 171, cotovelo: 5 }),
      frente({ ombro: 66, cotovelo: 82 }),
    ],
  },
  {
    // Remada de perfil. Aqui estava o pior caso: com os braços espelhados, um
    // puxava para a frente e o outro para trás. Agora os dois descem juntos e
    // sobem juntos, com o cotovelo indo para TRÁS e a barra chegando na barriga.
    id: 'remada', nome: 'Remada curvada', aparelho: 'barra', vista: 'lado', presoEm: 'maos',
    cicloMs: 1500, repeticoes: 4,
    quadros: [
      lado({ ombro: 5, cotovelo: -8, coxa: 12, joelho: 14 }, { tronco: 56, quadril: 2 }),
      lado({ ombro: 118, cotovelo: -148, coxa: 12, joelho: 14 }, { tronco: 54, quadril: 2 }),
      lado({ ombro: 5, cotovelo: -8, coxa: 12, joelho: 14 }, { tronco: 56, quadril: 2 }),
    ],
  },
  {
    // Terra de perfil: o quadril vai para trás, a canela fica quase em pé e os
    // braços penduram retos. Braço dobrado em levantamento terra é erro de
    // academia, então aqui o cotovelo quase não mexe.
    id: 'terra', nome: 'Levantamento terra', aparelho: 'barra', vista: 'lado', presoEm: 'maos',
    cicloMs: 2000, repeticoes: 3,
    quadros: [
      lado({ ombro: 3, cotovelo: -4, coxa: 2, joelho: 2 }, { tronco: 3 }),
      lado({ ombro: 1, cotovelo: -3, coxa: 26, joelho: -22 }, { tronco: 58, quadril: 4 }),
      lado({ ombro: 3, cotovelo: -4, coxa: 2, joelho: 2 }, { tronco: 3 }),
    ],
  },
  {
    // Elevação lateral: braço quase ESTICADO subindo até a horizontal. O
    // cotovelo em 86 fazia um gol de trave, não uma elevação.
    id: 'elevacao', nome: 'Elevação lateral', aparelho: 'halteres', vista: 'frente', presoEm: 'maos',
    cicloMs: 1500, repeticoes: 4,
    quadros: [
      frente({ ombro: 14, cotovelo: 8 }),
      frente({ ombro: 88, cotovelo: 14 }),
      frente({ ombro: 14, cotovelo: 8 }),
    ],
  },
  {
    // Tríceps de frente: braço parado apontando para cima, só o antebraço cai
    // atrás da cabeça. O que manda é o cotovelo ficar QUIETO no alto.
    id: 'triceps', nome: 'Tríceps francês', aparelho: 'halteres', vista: 'frente', presoEm: 'maos',
    cicloMs: 1500, repeticoes: 5,
    quadros: [
      frente({ ombro: 171, cotovelo: 5 }),
      frente({ ombro: 169, cotovelo: -148 }, { cabeca: 4 }),
      frente({ ombro: 171, cotovelo: 5 }),
    ],
  },
  {
    id: 'panturrilha', nome: 'Panturrilha', aparelho: 'halteres', vista: 'frente', presoEm: 'maos',
    cicloMs: 1100, repeticoes: 7,
    quadros: [
      frente({ ombro: 10, cotovelo: 6 }),
      frente({ ombro: 10, cotovelo: 6, coxa: 4, joelho: 0 }, { voo: 2.6 }),
      frente({ ombro: 10, cotovelo: 6 }),
    ],
  },
  {
    // Polichinelo é de frente por definição: braços e pernas abrem juntos.
    // O joelho acompanha a coxa para a canela ficar em pé e o pé não cruzar.
    id: 'polichinelo', nome: 'Polichinelo', aparelho: 'nenhum', vista: 'frente', presoEm: 'chao',
    cicloMs: 760, repeticoes: 8,
    quadros: [
      frente({ ombro: 6, cotovelo: 4, coxa: 4, joelho: -2 }),
      frente({ ombro: 156, cotovelo: 8, coxa: 26, joelho: -24 }, { voo: 3.2 }),
      frente({ ombro: 6, cotovelo: 4, coxa: 4, joelho: -2 }),
    ],
  },
  {
    // Corda também é de frente: é assim que a corda passa por baixo dos pés.
    // Antebraço na horizontal, braço colado no corpo -- quem pula corda não
    // abre os braços, gira só o punho.
    id: 'corda', nome: 'Pular corda', aparelho: 'corda', vista: 'frente', presoEm: 'maos',
    cicloMs: 620, repeticoes: 10,
    quadros: [
      frente({ ombro: 22, cotovelo: 68, coxa: 4, joelho: -6 }),
      frente({ ombro: 26, cotovelo: 74, coxa: 10, joelho: -18 }, { voo: 4.0 }),
      frente({ ombro: 22, cotovelo: 68, coxa: 4, joelho: -6 }),
    ],
  },
  {
    // Corrida é a ÚNICA cena em que espelhar está certo de perfil: braço e
    // perna opostos andam juntos de verdade. Por isso os ângulos vêm na mão.
    id: 'corrida', nome: 'Corrida no lugar', aparelho: 'nenhum', vista: 'lado', presoEm: 'chao',
    cicloMs: 620, repeticoes: 10,
    quadros: [
      { ...EM_PE, tronco: 6, ombroE: -48, cotoveloE: -86, ombroD: 48, cotoveloD: -92, coxaE: -46, joelhoE: 62, coxaD: 26, joelhoD: 16 },
      { ...EM_PE, tronco: 6, ombroE: 48, cotoveloE: -92, ombroD: -48, cotoveloD: -86, coxaE: 26, joelhoE: 16, coxaD: -46, joelhoD: 62 },
      { ...EM_PE, tronco: 6, ombroE: -48, cotoveloE: -86, ombroD: 48, cotoveloD: -92, coxaE: -46, joelhoE: 62, coxaD: 26, joelhoD: 16 },
    ],
  },
  {
    // Avanço de perfil: as pernas fazem coisas opostas de verdade, então vêm
    // escritas na mão. A da frente dobra em 90°, a de trás deixa o calcanhar
    // subir. Os braços só penduram com o peso.
    id: 'afundo', nome: 'Avanço', aparelho: 'halteres', vista: 'lado', presoEm: 'maos',
    cicloMs: 1800, repeticoes: 4,
    quadros: [
      lado({ ombro: 6, cotovelo: -6, coxa: 3, joelho: 2 }),
      lado({ ombro: 7, cotovelo: -7 }, {
        quadril: 5, tronco: 7,
        coxaE: -34, joelhoE: 34, coxaD: 30, joelhoD: 30,
      }),
      lado({ ombro: 6, cotovelo: -6, coxa: 3, joelho: 2 }),
    ],
  },

  /* ─── as pausas: é o que faz parecer gente, não motor ─── */
  {
    id: 'descanso', nome: 'Descansando', aparelho: 'nenhum', vista: 'lado', presoEm: 'chao',
    cicloMs: 2600, repeticoes: 1,
    quadros: [
      lado({ ombro: 12, cotovelo: -20 }, { tronco: 4 }),
      lado({ ombro: 9, cotovelo: -16 }, { tronco: 2, quadril: -1, cabeca: -3 }),
      lado({ ombro: 12, cotovelo: -20 }, { tronco: 4 }),
    ],
  },
  {
    // Só UMA mão sobe com a garrafa; a outra fica parada. Por isso os dois
    // lados vêm escritos, em vez de sair do construtor.
    id: 'agua', nome: 'Bebendo água', aparelho: 'garrafa', vista: 'lado', presoEm: 'maos',
    cicloMs: 2600, repeticoes: 1,
    quadros: [
      lado({ ombro: 10, cotovelo: -10 }),
      lado({ ombro: 10, cotovelo: -10 }, { ombroD: -54, cotoveloD: -128, cabeca: -12, tronco: -3 }),
      lado({ ombro: 10, cotovelo: -10 }, { ombroD: -58, cotoveloD: -140, cabeca: -18, tronco: -4 }),
      lado({ ombro: 10, cotovelo: -10 }),
    ],
  },
  {
    id: 'celular', nome: 'Olhando o celular', aparelho: 'celular', vista: 'lado', presoEm: 'maos',
    cicloMs: 3000, repeticoes: 1,
    quadros: [
      lado({ ombro: 26, cotovelo: -92 }, { cabeca: 16, tronco: 7 }),
      lado({ ombro: 28, cotovelo: -98 }, { cabeca: 18, tronco: 8 }),
      lado({ ombro: 26, cotovelo: -92 }, { cabeca: 16, tronco: 7 }),
    ],
  },
  {
    id: 'troca', nome: 'Trocando de aparelho', aparelho: 'barra', vista: 'lado', presoEm: 'maos',
    cicloMs: 2200, repeticoes: 1,
    quadros: [
      lado({ ombro: 6, cotovelo: -12, coxa: 18, joelho: 20 }, { tronco: 28 }),
      lado({ ombro: 4, cotovelo: -10, coxa: 24, joelho: 26 }, { tronco: 34, quadril: 3 }),
      lado({ ombro: 6, cotovelo: -12, coxa: 18, joelho: 20 }, { tronco: 28 }),
    ],
  },
] as const;

const PAUSAS = ['descanso', 'agua', 'celular', 'troca'];
export const EXERCICIOS = CENAS.filter((c) => !PAUSAS.includes(c.id));

/** Suaviza a entrada e a saída de cada quadro: sem isso o movimento vira pulso. */
const suave = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

const entre = (a: number, b: number, t: number) => a + (b - a) * t;

/** Pose da cena no instante `t` (0 a 1 dentro do ciclo). */
export function poseNoTempo(cena: Cena, t: number): Pose {
  const q = cena.quadros;
  const total = q.length - 1;
  const pos = Math.min(Math.max(t, 0), 1) * total;
  // o corte antigo (0.999999) fazia t=1 parar um fio antes do último quadro
  const i = Math.min(Math.floor(pos), total - 1);
  const f = suave(pos - i);
  const a = q[i];
  const b = q[Math.min(i + 1, total)];

  const saida = {} as Pose;
  for (const chave of Object.keys(EM_PE) as Array<keyof Pose>) {
    saida[chave] = entre(a[chave], b[chave], f);
  }
  return saida;
}

/**
 * Atraso das pontas: antebraço e canela perseguem o alvo com folga, então
 * chegam depois do ombro e do quadril. É o que tira a cara de boneco de pau.
 */
export function comAtraso(atual: Pose, alvo: Pose, forca = 0.22, msDoQuadro = 1000 / 60): Pose {
  // Sem corrigir pelo tempo, o mesmo fator rende perseguições diferentes: num
  // monitor de 144Hz cabem 14 quadros em 100ms contra 6 num de 60Hz, e o braço
  // chegava quase sem atraso. Aqui 0.22 passa a valer "por 1/60 de segundo".
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
  cotoveloE: Ponto; maoE: Ponto; cotoveloD: Ponto; maoD: Ponto;
  joelhoE: Ponto; peE: Ponto; joelhoD: Ponto; peD: Ponto;
}

const TAMANHO = { tronco: 13, braco: 7, antebraco: 7, coxa: 8, canela: 8, pescoco: 4.6 };

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

  const cotoveloE = desloca(ombro, p.ombroE, TAMANHO.braco);
  const maoE = desloca(cotoveloE, p.ombroE + p.cotoveloE, TAMANHO.antebraco);
  const cotoveloD = desloca(ombro, p.ombroD, TAMANHO.braco);
  const maoD = desloca(cotoveloD, p.ombroD + p.cotoveloD, TAMANHO.antebraco);

  const joelhoE = desloca(quadril, p.coxaE, TAMANHO.coxa);
  const peE = desloca(joelhoE, p.coxaE + p.joelhoE, TAMANHO.canela);
  const joelhoD = desloca(quadril, p.coxaD, TAMANHO.coxa);
  const peD = desloca(joelhoD, p.coxaD + p.joelhoD, TAMANHO.canela);

  return { quadril, ombro, cabeca, cotoveloE, maoE, cotoveloD, maoD, joelhoE, peE, joelhoD, peD };
}

/** Onde o chão é desenhado. O componente usa o mesmo número na linha. */
export const CHAO_Y = 46.2;

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
    cotoveloE: mover(e.cotoveloE), maoE: mover(e.maoE),
    cotoveloD: mover(e.cotoveloD), maoD: mover(e.maoD),
    joelhoE: mover(e.joelhoE), peE: mover(e.peE),
    joelhoD: mover(e.joelhoD), peD: mover(e.peD),
  };
}
