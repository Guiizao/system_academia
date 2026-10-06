import { describe, it, expect } from 'vitest';
import {
  ALTURA_DO_APARELHO, CENAS, EXERCICIOS, PARADO, PEGAR, MOMENTO_DA_PEGADA, CHAO_Y,
  poseNoTempo, poseDosQuadros, comAtraso, esqueletoDe, assentarNoChao, faseDaCorda, arcoDaCorda,
} from '../src/dominio/boneco';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('roteiro', () => {
  it('tem pelo menos 10 exercicios de verdade', () => {
    expect(EXERCICIOS.length).toBeGreaterThanOrEqual(10);
  });

  it('e tambem as pausas: descanso, agua e celular', () => {
    const ids = CENAS.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['descanso', 'agua', 'celular']));
  });

  it('toda cena comeca e termina na mesma pose (o ciclo fecha, nao pula)', () => {
    for (const c of CENAS) {
      expect(c.quadros.at(-1), `cena ${c.id}`).toEqual(c.quadros[0]);
    }
  });

  it('toda cena tem ciclo e repeticoes utilizaveis', () => {
    for (const c of CENAS) {
      expect(c.cicloMs, `cena ${c.id}`).toBeGreaterThan(300);
      expect(c.repeticoes, `cena ${c.id}`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('a camera escolhe o angulo de cada exercicio', () => {
  /*
   * Metade dos exercicios so se le de um angulo: polichinelo e elevacao
   * lateral precisam de FRENTE, remada curvada e terra precisam de PERFIL.
   * Com tudo de frente, a remada virava um boneco tombado de lado; com tudo
   * de perfil, um braco cobria o outro. Entao cada cena declara a sua vista.
   */
  const frontais = () => CENAS.filter((c) => c.vista === 'frente');
  const laterais = () => CENAS.filter((c) => c.vista === 'lado');
  /* correr e beber agua sao assimetricos de verdade, em qualquer angulo */
  const ASSIMETRICOS = ['corrida', 'agua'];

  it('toda cena diz de que angulo esta sendo vista', () => {
    for (const c of CENAS) expect(['frente', 'lado'], `cena ${c.id}`).toContain(c.vista);
    expect(frontais().length, 'tem exercicio de frente').toBeGreaterThan(5);
    expect(laterais().length, 'e tem exercicio de perfil').toBeGreaterThan(2);
  });

  it('de frente os dois bracos sao espelho um do outro', () => {
    for (const cena of frontais().filter((c) => !ASSIMETRICOS.includes(c.id))) {
      for (const q of cena.quadros) {
        expect(q.ombroD, `${cena.id} ombro`).toBe(-q.ombroE);
        expect(q.cotoveloD, `${cena.id} cotovelo`).toBe(-q.cotoveloE);
      }
    }
  });

  it('de perfil os dois bracos vao para o MESMO lado', () => {
    // espelhar de perfil manda um braco para a frente e o outro para tras:
    // o boneco parecia fazer dois exercicios ao mesmo tempo
    for (const cena of laterais().filter((c) => !ASSIMETRICOS.includes(c.id))) {
      for (const q of cena.quadros) {
        const juntos = (a: number, b: number) => Math.sign(a) === Math.sign(b) || Math.abs(a - b) <= 12;
        expect(juntos(q.ombroE, q.ombroD), `${cena.id}: ombro ${q.ombroE} vs ${q.ombroD}`).toBe(true);
        expect(juntos(q.cotoveloE, q.cotoveloD), `${cena.id}: cotovelo`).toBe(true);
      }
    }
  });

  it('de frente o tronco quase nao inclina: inclinar ali le como tombar de lado', () => {
    for (const cena of frontais()) {
      for (const q of cena.quadros) {
        expect(Math.abs(q.tronco), `${cena.id} tronco`).toBeLessThanOrEqual(6);
      }
    }
  });

  it('a dobradica de quadril so aparece de perfil, que e onde ela se ve', () => {
    for (const id of ['remada', 'terra']) {
      const cena = CENAS.find((c) => c.id === id)!;
      expect(cena.vista, `${id} precisa ser de perfil`).toBe('lado');
      expect(Math.max(...cena.quadros.map((q) => q.tronco)), `${id} curva o tronco`).toBeGreaterThan(40);
    }
  });

  it('nenhum antebraco dobra para tras do proprio braco', () => {
    // cotovelo 170 com ombro 164 apontava o antebraco para 334 graus: o braco
    // "subia" e o antebraco voltava para baixo. Lia como braco quebrado.
    for (const cena of CENAS) {
      for (const q of cena.quadros) {
        expect(Math.abs(q.cotoveloE), `${cena.id} cotovelo E`).toBeLessThanOrEqual(150);
        expect(Math.abs(q.cotoveloD), `${cena.id} cotovelo D`).toBeLessThanOrEqual(150);
      }
    }
  });
});

describe('as juntas nao ficam uma dentro da outra', () => {
  it('ombro e quadril tem largura: os dois lados nascem separados', () => {
    const e = esqueletoDe(PARADO);
    expect(dist(e.ombroE, e.ombroD), 'linha dos ombros').toBeGreaterThan(4);
    expect(dist(e.quadrilE, e.quadrilD), 'linha do quadril').toBeGreaterThan(3);
  });

  it('de frente, as duas maos nunca se sobrepoem', () => {
    // maos coladas uma na outra viravam um borrao, e o aparelho sumia dentro.
    // De perfil elas ficam perto de proposito: uma esta atras da outra.
    for (const cena of CENAS.filter((c) => c.vista === 'frente')) {
      for (const t of [0, 0.25, 0.5, 0.75]) {
        const e = esqueletoDe(poseNoTempo(cena, t));
        expect(dist(e.maoE, e.maoD), `${cena.id} em t=${t}`).toBeGreaterThan(1.5);
      }
    }
  });

  it('de frente, nenhum cotovelo cai em cima do outro', () => {
    for (const cena of CENAS.filter((c) => c.vista === 'frente')) {
      for (const t of [0, 0.25, 0.5, 0.75]) {
        const e = esqueletoDe(poseNoTempo(cena, t));
        expect(dist(e.cotoveloE, e.cotoveloD), `${cena.id} em t=${t}`).toBeGreaterThan(1.5);
      }
    }
  });
});

describe('poseNoTempo', () => {
  const cena = CENAS.find((c) => c.id === 'rosca')!;

  it('no comeco entrega o primeiro quadro', () => {
    expect(poseNoTempo(cena, 0)).toEqual(cena.quadros[0]);
  });

  it('em t=1 entrega o ultimo quadro, nao um fio antes', () => {
    for (const c of CENAS) {
      expect(poseNoTempo(c, 1), `cena ${c.id}`).toEqual(c.quadros.at(-1));
    }
  });

  it('entre dois quadros fica no meio do caminho, nunca fora', () => {
    const m = poseNoTempo(cena, 0.12);
    const [a, b] = [cena.quadros[0].cotoveloE, cena.quadros[1].cotoveloE];
    expect(m.cotoveloE).toBeGreaterThan(Math.min(a, b));
    expect(m.cotoveloE).toBeLessThan(Math.max(a, b));
  });

  it('o movimento desacelera nas pontas (nao e linear)', () => {
    const inicio = poseNoTempo(cena, 0.02).cotoveloE - poseNoTempo(cena, 0).cotoveloE;
    const meio = poseNoTempo(cena, 0.14).cotoveloE - poseNoTempo(cena, 0.12).cotoveloE;
    expect(Math.abs(meio)).toBeGreaterThan(Math.abs(inicio));
  });

  it('tempo fora do intervalo nao quebra', () => {
    expect(() => poseNoTempo(cena, -1)).not.toThrow();
    expect(() => poseNoTempo(cena, 2)).not.toThrow();
  });
});

describe('comAtraso', () => {
  const cena = CENAS.find((c) => c.id === 'rosca')!;

  it('a ponta nao chega junto com o alvo: fica para tras', () => {
    const atual = poseNoTempo(cena, 0);
    const alvo = poseNoTempo(cena, 0.5);
    const r = comAtraso(atual, alvo);
    expect(Math.abs(r.cotoveloE - alvo.cotoveloE)).toBeGreaterThan(0);
    expect(Math.abs(r.cotoveloE - atual.cotoveloE)).toBeGreaterThan(0);
  });

  it('o ombro acompanha o alvo na hora (so a ponta atrasa)', () => {
    const alvo = poseNoTempo(cena, 0.5);
    expect(comAtraso(poseNoTempo(cena, 0), alvo).ombroE).toBe(alvo.ombroE);
  });

  it('repetindo, a ponta alcanca o alvo', () => {
    const alvo = poseNoTempo(cena, 0.5);
    let p = poseNoTempo(cena, 0);
    for (let i = 0; i < 90; i++) p = comAtraso(p, alvo);
    expect(p.cotoveloE).toBeCloseTo(alvo.cotoveloE, 1);
  });

  it('o atraso nao depende da taxa de quadros do monitor', () => {
    const alvo = poseNoTempo(CENAS[0], 0.5);
    const partida = poseNoTempo(CENAS[0], 0);
    let a60 = partida;
    for (let i = 0; i < 6; i++) a60 = comAtraso(a60, alvo, 0.18, 1000 / 60);
    const umPasso = comAtraso(partida, alvo, 0.18, 100);
    expect(umPasso.cotoveloE).toBeCloseTo(a60.cotoveloE, 6);
  });

  it('com quadro de duracao zero, nada se move', () => {
    const alvo = poseNoTempo(CENAS[0], 0.5);
    const partida = poseNoTempo(CENAS[0], 0);
    expect(comAtraso(partida, alvo, 0.18, 0).cotoveloE).toBe(partida.cotoveloE);
  });
});

describe('esqueleto', () => {
  it('os ossos tem sempre o mesmo tamanho, em qualquer pose', () => {
    for (const cena of CENAS) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const e = esqueletoDe(poseNoTempo(cena, t));
        expect(dist(e.ombroE, e.cotoveloE), `${cena.id} braço`).toBeCloseTo(7, 5);
        expect(dist(e.cotoveloE, e.maoE), `${cena.id} antebraço`).toBeCloseTo(7, 5);
        expect(dist(e.quadrilD, e.joelhoD), `${cena.id} coxa`).toBeCloseTo(8, 5);
        expect(dist(e.joelhoD, e.peD), `${cena.id} canela`).toBeCloseTo(8, 5);
        expect(dist(e.quadril, e.ombro), `${cena.id} tronco`).toBeCloseTo(13, 5);
      }
    }
  });

  it('em pe, o ombro fica acima do quadril e os pes abaixo', () => {
    const e = esqueletoDe(PARADO);
    expect(e.ombro.y).toBeLessThan(e.quadril.y);
    expect(e.peD.y).toBeGreaterThan(e.quadril.y);
    expect(e.cabeca.y).toBeLessThan(e.ombro.y);
  });

  it('ninguem sai do quadro do desenho', () => {
    for (const cena of CENAS) {
      for (const t of [0, 0.3, 0.6, 0.9]) {
        const e = esqueletoDe(poseNoTempo(cena, t));
        for (const [nome, p] of Object.entries(e)) {
          expect(p.x, `${cena.id}.${nome} x`).toBeGreaterThan(-4);
          expect(p.x, `${cena.id}.${nome} x`).toBeLessThan(68);
          expect(p.y, `${cena.id}.${nome} y`).toBeGreaterThan(-4);
          expect(p.y, `${cena.id}.${nome} y`).toBeLessThan(52);
        }
      }
    }
  });
});

describe('os pes ficam no chao', () => {
  it('em TODA cena e em TODO instante, o pe de apoio toca o chao', () => {
    for (const cena of CENAS) {
      for (let i = 0; i <= 20; i++) {
        const p = poseNoTempo(cena, i / 20);
        const e = assentarNoChao(esqueletoDe(p), p.voo);
        const apoio = Math.max(e.peE.y, e.peD.y);
        expect(apoio, `${cena.id} em t=${i / 20}`).toBeCloseTo(CHAO_Y - p.voo, 5);
      }
    }
  });

  it('nenhum pe atravessa o chao', () => {
    for (const cena of CENAS) {
      for (let i = 0; i <= 20; i++) {
        const p = poseNoTempo(cena, i / 20);
        const e = assentarNoChao(esqueletoDe(p), p.voo);
        expect(Math.max(e.peE.y, e.peD.y), `${cena.id}`).toBeLessThanOrEqual(CHAO_Y + 0.001);
      }
    }
  });

  it('so quem pula sai do chao, e so no meio do movimento', () => {
    const saltam = CENAS.filter((c) => c.quadros.some((q) => q.voo > 0)).map((c) => c.id);
    expect(saltam.sort()).toEqual(['corda', 'panturrilha', 'polichinelo']);
    for (const id of saltam) {
      const cena = CENAS.find((c) => c.id === id)!;
      expect(poseNoTempo(cena, 0).voo, `${id} comeca no chao`).toBe(0);
      expect(poseNoTempo(cena, 0.5).voo, `${id} no ar no meio`).toBeGreaterThan(1);
    }
  });

  it('assentar nao deforma: os ossos mantem o comprimento', () => {
    const p = poseNoTempo(CENAS[0], 0.5);
    const antes = esqueletoDe(p);
    const depois = assentarNoChao(antes, p.voo);
    expect(dist(depois.quadrilE, depois.joelhoE)).toBeCloseTo(dist(antes.quadrilE, antes.joelhoE), 10);
    expect(dist(depois.ombroD, depois.cotoveloD)).toBeCloseTo(dist(antes.ombroD, antes.cotoveloD), 10);
  });

  it('no agachamento o quadril DESCE de verdade', () => {
    const cena = CENAS.find((c) => c.id === 'agachamento')!;
    const emPe = assentarNoChao(esqueletoDe(poseNoTempo(cena, 0)), 0);
    const pFundo = poseNoTempo(cena, 0.5);
    const fundo = assentarNoChao(esqueletoDe(pFundo), pFundo.voo);
    // y cresce para baixo: agachado o quadril precisa estar MAIS BAIXO
    expect(fundo.quadril.y).toBeGreaterThan(emPe.quadril.y + 2);
  });

  it('no agachamento as duas pernas sao espelhadas', () => {
    // pernas desiguais deixavam um pe abaixo do outro, e um unico deslocamento
    // vertical nao consegue assentar os dois
    const fundo = CENAS.find((c) => c.id === 'agachamento')!.quadros[2];
    expect(fundo.coxaE).toBe(-fundo.coxaD);
    expect(fundo.joelhoE).toBe(-fundo.joelhoD);
  });
});

describe('cada exercicio parece o exercicio', () => {
  it('na rosca o ombro fica parado: e isso que diferencia de um arremesso', () => {
    const rosca = CENAS.find((c) => c.id === 'rosca')!;
    expect(new Set(rosca.quadros.map((q) => q.ombroE)).size, 'o ombro nao pode variar').toBe(1);
  });

  it('no topo da rosca a mao sobe ate o ombro, em vez de abrir para o lado', () => {
    const rosca = CENAS.find((c) => c.id === 'rosca')!;
    const topo = esqueletoDe(rosca.quadros[2]);
    expect(Math.abs(topo.maoE.y - topo.ombroE.y), 'mao na altura do ombro').toBeLessThan(2);
    expect(Math.abs(topo.maoE.x - topo.ombroE.x), 'mao nao abre mais que o cotovelo')
      .toBeLessThan(Math.abs(topo.cotoveloE.x - topo.ombroE.x) + 3);
  });

  it('na elevacao lateral o braco sobe esticado, nao em trave de gol', () => {
    const alto = CENAS.find((c) => c.id === 'elevacao')!.quadros[2];
    expect(Math.abs(alto.cotoveloE), 'cotovelo quase reto').toBeLessThan(30);
    expect(Math.abs(alto.ombroE), 'braco na horizontal').toBeGreaterThan(75);
  });

  it('no triceps o cotovelo fica parado no alto e so o antebraco cai', () => {
    const t = CENAS.find((c) => c.id === 'triceps')!;
    const cotovelos = t.quadros.map((q) => esqueletoDe(q).cotoveloE);
    for (const c of cotovelos.slice(1)) expect(dist(c, cotovelos[0])).toBeLessThan(0.8);
  });

  it('no terra o braco fica reto: braco dobrado em terra e erro de academia', () => {
    for (const q of CENAS.find((c) => c.id === 'terra')!.quadros) {
      expect(Math.abs(q.cotoveloE), 'cotovelo quase reto').toBeLessThan(10);
    }
  });

  it('o movimento nao PARA no meio da repeticao', () => {
    // era a animacao travada: suavizando cada trecho sozinho, a velocidade
    // caia a zero em todo quadro intermediario. Agora so desacelera onde o
    // movimento realmente vira.
    const cena = CENAS.find((c) => c.id === 'rosca')!;
    const vel = (t: number) => Math.abs(poseNoTempo(cena, t + 0.004).cotoveloE - poseNoTempo(cena, t).cotoveloE);
    // 0.25 cai exatamente em cima do quadro do meio da subida
    expect(vel(0.25), 'passa pelo quadro do meio sem parar').toBeGreaterThan(0.2);
    expect(vel(0.5), 'mas desacelera no topo').toBeLessThan(vel(0.25));
  });
});

describe('ir buscar o aparelho', () => {
  it('comeca e termina em pe', () => {
    expect(PEGAR[0]).toEqual(PARADO);
    expect(PEGAR.at(-1)).toEqual(PARADO);
  });

  it('no meio ele agacha e a mao encontra o aparelho', () => {
    const p = poseDosQuadros(PEGAR, MOMENTO_DA_PEGADA);
    const e = assentarNoChao(esqueletoDe(p), p.voo);
    const emPe = assentarNoChao(esqueletoDe(PARADO), 0);
    expect(e.quadril.y, 'o quadril desce').toBeGreaterThan(emPe.quadril.y + 3);
    // a mao precisa CHEGAR na altura em que o peso esta esperando, senao o
    // aparelho pularia para a mao a uma distancia visivel
    expect(Math.abs(e.maoE.y - ALTURA_DO_APARELHO), 'mao na altura do aparelho').toBeLessThan(2);
  });

  it('pegando, os pes continuam no chao', () => {
    for (let i = 0; i <= 10; i++) {
      const p = poseDosQuadros(PEGAR, i / 10);
      const e = assentarNoChao(esqueletoDe(p), p.voo);
      expect(Math.max(e.peE.y, e.peD.y)).toBeCloseTo(CHAO_Y, 5);
    }
  });
});

describe('a corda gira', () => {
  it('em cima quando ele esta no chao, embaixo quando ele esta no ar', () => {
    expect(faseDaCorda(0)).toBeCloseTo(1, 6);
    expect(faseDaCorda(0.5)).toBeCloseTo(-1, 6);
    expect(faseDaCorda(1)).toBeCloseTo(1, 6);
  });

  it('nunca passa dos limites: e sempre entre -1 e 1', () => {
    for (let i = 0; i <= 40; i++) {
      const f = faseDaCorda(i / 40);
      expect(f).toBeGreaterThanOrEqual(-1);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('a corda passa por baixo no instante em que ele esta no ar', () => {
    // antes a corda era um arco parado que atravessava o chao; agora o ponto
    // mais baixo dela coincide com o pulo
    const cena = CENAS.find((c) => c.id === 'corda')!;
    expect(poseNoTempo(cena, 0.5).voo, 'no ar no meio do ciclo').toBeGreaterThan(1);
    expect(faseDaCorda(0.5), 'corda embaixo no meio do ciclo').toBeCloseTo(-1, 6);
  });
});

describe('o arco da corda', () => {
  const cena = CENAS.find((c) => c.id === 'corda')!;
  const esqueletoEm = (t: number) => {
    const p = poseNoTempo(cena, t);
    return assentarNoChao(esqueletoDe(p), p.voo);
  };

  it('NUNCA passa do chao: era isso que estava quebrado', () => {
    // a versao antiga mergulhava 5 unidades abaixo do piso, sempre
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const arco = arcoDaCorda(esqueletoEm(t), faseDaCorda(t));
      expect(arco.apiceY, `t=${t}`).toBeLessThanOrEqual(CHAO_Y);
    }
  });

  it('passa por baixo dos pes exatamente quando ele esta no ar', () => {
    const t = 0.5;
    const e = esqueletoEm(t);
    const arco = arcoDaCorda(e, faseDaCorda(t));
    expect(arco.apiceY, 'abaixo dos pes').toBeGreaterThan(Math.max(e.peE.y, e.peD.y));
    expect(arco.apiceY, 'mas acima do chao').toBeLessThanOrEqual(CHAO_Y);
  });

  it('passa por cima da cabeca quando ele esta no chao', () => {
    const e = esqueletoEm(0);
    const arco = arcoDaCorda(e, faseDaCorda(0));
    expect(arco.apiceY, 'acima da cabeca').toBeLessThan(e.cabeca.y);
  });

  it('ela GIRA: o arco muda de altura ao longo do ciclo', () => {
    const alturas = [0, 0.25, 0.5, 0.75].map((t) => arcoDaCorda(esqueletoEm(t), faseDaCorda(t)).apiceY);
    expect(new Set(alturas.map((a) => a.toFixed(2))).size, 'alturas diferentes').toBeGreaterThan(2);
    expect(Math.max(...alturas) - Math.min(...alturas), 'percorre um bom trecho').toBeGreaterThan(15);
  });

  it('some quando esta de perfil, no meio do giro', () => {
    const e = esqueletoEm(0.25);
    expect(arcoDaCorda(e, faseDaCorda(0.25)).opacidade).toBeLessThan(0.4);
    expect(arcoDaCorda(e, faseDaCorda(0)).opacidade).toBeCloseTo(1, 1);
  });
});
