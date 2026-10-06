/**
 * O bonequinho da academia: esqueleto articulado, não figura rígida.
 *
 * A versão anterior girava peças inteiras no CSS e ficava dura. Aqui cada
 * junta tem ângulo próprio (ombro, cotovelo, quadril, joelho), a pose é
 * interpolada quadro a quadro e as pontas chegam ATRASADAS em relação à raiz
 * — é esse atraso que faz o braço parecer solto em vez de um graveto.
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

const pose = (p: Partial<Pose>): Pose => ({ ...EM_PE, ...p });

/**
 * 12 exercícios + as pausas. A ordem conta uma sessão de treino: puxa o
 * aparelho, faz a série, descansa, bebe água, mexe no celular, troca.
 */
export const CENAS: readonly Cena[] = [
  {
    id: 'agachamento', nome: 'Agachamento', aparelho: 'barra', presoEm: 'ombros', cicloMs: 1700, repeticoes: 4,
    quadros: [
      pose({ ombroE: 120, cotoveloE: 50, ombroD: -120, cotoveloD: -50 }),
      pose({ tronco: 14, coxaE: 46, joelhoE: -52, coxaD: -46, joelhoD: 52, ombroE: 120, cotoveloE: 50, ombroD: -120, cotoveloD: -50 }),
      pose({ ombroE: 120, cotoveloE: 50, ombroD: -120, cotoveloD: -50 }),
    ],
  },
  {
    id: 'rosca', nome: 'Rosca direta', aparelho: 'halteres', presoEm: 'maos', cicloMs: 1300, repeticoes: 5,
    quadros: [
      pose({ ombroE: 10, cotoveloE: 6, ombroD: -10, cotoveloD: -6 }),
      pose({ ombroE: 10, cotoveloE: 128, ombroD: -10, cotoveloD: -128 }),
      pose({ ombroE: 10, cotoveloE: 6, ombroD: -10, cotoveloD: -6 }),
    ],
  },
  {
    id: 'desenvolvimento', nome: 'Desenvolvimento', aparelho: 'barra', presoEm: 'maos', cicloMs: 1600, repeticoes: 4,
    quadros: [
      pose({ ombroE: 80, cotoveloE: 80, ombroD: -80, cotoveloD: -80 }),
      pose({ ombroE: 160, cotoveloE: 8, ombroD: -160, cotoveloD: -8 }),
      pose({ ombroE: 80, cotoveloE: 80, ombroD: -80, cotoveloD: -80 }),
    ],
  },
  {
    id: 'remada', nome: 'Remada curvada', aparelho: 'barra', presoEm: 'maos', cicloMs: 1500, repeticoes: 4,
    quadros: [
      pose({ tronco: 52, quadril: 2, ombroE: -34, cotoveloE: -8, ombroD: 34, cotoveloD: 8, coxaE: 12, joelhoE: -14, coxaD: -12, joelhoD: 14 }),
      pose({ tronco: 50, quadril: 2, ombroE: 10, cotoveloE: 104, ombroD: -10, cotoveloD: -104, coxaE: 12, joelhoE: -14, coxaD: -12, joelhoD: 14 }),
      pose({ tronco: 52, quadril: 2, ombroE: -34, cotoveloE: -8, ombroD: 34, cotoveloD: 8, coxaE: 12, joelhoE: -14, coxaD: -12, joelhoD: 14 }),
    ],
  },
  {
    id: 'terra', nome: 'Levantamento terra', aparelho: 'barra', presoEm: 'maos', cicloMs: 2000, repeticoes: 3,
    quadros: [
      pose({ tronco: 2, ombroE: 4, cotoveloE: 2, ombroD: -4, cotoveloD: -2 }),
      pose({ tronco: 62, quadril: 6, coxaE: 34, joelhoE: -38, coxaD: -30, joelhoD: 40, ombroE: -10, cotoveloE: -2, ombroD: 10, cotoveloD: 2 }),
      pose({ tronco: 2, ombroE: 4, cotoveloE: 2, ombroD: -4, cotoveloD: -2 }),
    ],
  },
  {
    id: 'elevacao', nome: 'Elevação lateral', aparelho: 'halteres', presoEm: 'maos', cicloMs: 1500, repeticoes: 4,
    quadros: [
      pose({ ombroE: 12, cotoveloE: 8, ombroD: -12, cotoveloD: -8 }),
      pose({ ombroE: 92, cotoveloE: 86, ombroD: -92, cotoveloD: -86 }),
      pose({ ombroE: 12, cotoveloE: 8, ombroD: -12, cotoveloD: -8 }),
    ],
  },
  {
    // exercicio de chao nao le bem num boneco de perfil deste tamanho:
    // vira um risco horizontal. Os 12 sao todos em pe, de proposito.
    id: 'triceps', nome: 'Tríceps francês', aparelho: 'halteres', presoEm: 'maos', cicloMs: 1500, repeticoes: 5,
    quadros: [
      pose({ ombroE: 166, cotoveloE: 4, ombroD: -166, cotoveloD: -4 }),
      pose({ ombroE: 164, cotoveloE: -118, ombroD: -164, cotoveloD: 118, cabeca: 4 }),
      pose({ ombroE: 166, cotoveloE: 4, ombroD: -166, cotoveloD: -4 }),
    ],
  },
  {
    id: 'panturrilha', nome: 'Panturrilha', aparelho: 'halteres', presoEm: 'maos', cicloMs: 1100, repeticoes: 7,
    quadros: [
      pose({ ombroE: 10, cotoveloE: 6, ombroD: -10, cotoveloD: -6 }),
      pose({ voo: 2.6, ombroE: 10, cotoveloE: 6, ombroD: -10, cotoveloD: -6, coxaE: 4, joelhoE: 0, coxaD: -4, joelhoD: 0 }),
      pose({ ombroE: 10, cotoveloE: 6, ombroD: -10, cotoveloD: -6 }),
    ],
  },
  {
    id: 'polichinelo', nome: 'Polichinelo', aparelho: 'nenhum', presoEm: 'chao', cicloMs: 760, repeticoes: 8,
    quadros: [
      pose({ ombroE: 6, cotoveloE: 4, ombroD: -6, cotoveloD: -4, coxaE: 4, coxaD: -4 }),
      pose({ voo: 3.4, ombroE: 164, cotoveloE: 4, ombroD: -164, cotoveloD: -4, coxaE: 24, joelhoE: -4, coxaD: -24, joelhoD: 4 }),
      pose({ ombroE: 6, cotoveloE: 4, ombroD: -6, cotoveloD: -4, coxaE: 4, coxaD: -4 }),
    ],
  },
  {
    id: 'corda', nome: 'Pular corda', aparelho: 'corda', presoEm: 'maos', cicloMs: 620, repeticoes: 10,
    quadros: [
      pose({ ombroE: 44, cotoveloE: 96, ombroD: -44, cotoveloD: -96, coxaE: 4, joelhoE: -6, coxaD: -4, joelhoD: 6 }),
      pose({ voo: 4.2, ombroE: 40, cotoveloE: 104, ombroD: -40, cotoveloD: -104, coxaE: 10, joelhoE: -34, coxaD: -10, joelhoD: 34 }),
      pose({ ombroE: 44, cotoveloE: 96, ombroD: -44, cotoveloD: -96, coxaE: 4, joelhoE: -6, coxaD: -4, joelhoD: 6 }),
    ],
  },
  {
    id: 'corrida', nome: 'Corrida no lugar', aparelho: 'nenhum', presoEm: 'chao', cicloMs: 620, repeticoes: 10,
    quadros: [
      pose({ tronco: 6, ombroE: 54, cotoveloE: 92, ombroD: -54, cotoveloD: -92, coxaE: 52, joelhoE: -74, coxaD: -22, joelhoD: 16 }),
      pose({ tronco: 6, ombroE: -54, cotoveloE: -92, ombroD: 54, cotoveloD: 92, coxaE: -22, joelhoE: 16, coxaD: 52, joelhoD: -74 }),
      pose({ tronco: 6, ombroE: 54, cotoveloE: 92, ombroD: -54, cotoveloD: -92, coxaE: 52, joelhoE: -74, coxaD: -22, joelhoD: 16 }),
    ],
  },
  {
    id: 'afundo', nome: 'Avanço', aparelho: 'halteres', presoEm: 'maos', cicloMs: 1800, repeticoes: 4,
    quadros: [
      pose({ ombroE: 10, cotoveloE: 6, ombroD: -10, cotoveloD: -6 }),
      pose({ quadril: 8, tronco: 6, coxaE: 54, joelhoE: -64, coxaD: -46, joelhoD: 70, ombroE: 10, cotoveloE: 6, ombroD: -10, cotoveloD: -6 }),
      pose({ ombroE: 10, cotoveloE: 6, ombroD: -10, cotoveloD: -6 }),
    ],
  },

  /* ─── as pausas: é o que faz parecer gente, não motor ─── */
  {
    id: 'descanso', nome: 'Descansando', aparelho: 'nenhum', presoEm: 'chao', cicloMs: 2600, repeticoes: 1,
    quadros: [
      pose({ tronco: 4, ombroE: 14, cotoveloE: 22, ombroD: -14, cotoveloD: -22 }),
      pose({ tronco: 2, quadril: -1, ombroE: 10, cotoveloE: 18, ombroD: -10, cotoveloD: -18, cabeca: -3 }),
      pose({ tronco: 4, ombroE: 14, cotoveloE: 22, ombroD: -14, cotoveloD: -22 }),
    ],
  },
  {
    id: 'agua', nome: 'Bebendo água', aparelho: 'garrafa', presoEm: 'maos', cicloMs: 2600, repeticoes: 1,
    quadros: [
      pose({ ombroE: 12, cotoveloE: 10, ombroD: -12, cotoveloD: -10 }),
      pose({ ombroE: 12, cotoveloE: 10, ombroD: -62, cotoveloD: -138, cabeca: -14, tronco: -3 }),
      pose({ ombroE: 12, cotoveloE: 10, ombroD: -66, cotoveloD: -146, cabeca: -20, tronco: -4 }),
      pose({ ombroE: 12, cotoveloE: 10, ombroD: -12, cotoveloD: -10 }),
    ],
  },
  {
    id: 'celular', nome: 'Olhando o celular', aparelho: 'celular', presoEm: 'maos', cicloMs: 3000, repeticoes: 1,
    quadros: [
      pose({ cabeca: 16, tronco: 7, ombroE: 40, cotoveloE: 104, ombroD: -40, cotoveloD: -104 }),
      pose({ cabeca: 18, tronco: 8, ombroE: 42, cotoveloE: 110, ombroD: -38, cotoveloD: -100 }),
      pose({ cabeca: 16, tronco: 7, ombroE: 40, cotoveloE: 104, ombroD: -40, cotoveloD: -104 }),
    ],
  },
  {
    id: 'troca', nome: 'Trocando de aparelho', aparelho: 'barra', presoEm: 'maos', cicloMs: 2200, repeticoes: 1,
    quadros: [
      pose({ tronco: 26, ombroE: -46, cotoveloE: -10, ombroD: -46, cotoveloD: -10, coxaE: 20, joelhoE: -16, coxaD: -16, joelhoD: 12 }),
      pose({ tronco: 32, quadril: 3, ombroE: -58, cotoveloE: -16, ombroD: -58, cotoveloD: -16, coxaE: 26, joelhoE: -20, coxaD: -20, joelhoD: 16 }),
      pose({ tronco: 26, ombroE: -46, cotoveloE: -10, ombroD: -46, cotoveloD: -10, coxaE: 20, joelhoE: -16, coxaD: -16, joelhoD: 12 }),
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
