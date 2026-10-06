import { describe, it, expect } from 'vitest';
import { CENAS, EXERCICIOS, poseNoTempo, comAtraso, esqueletoDe, assentarNoChao } from '../src/dominio/boneco';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('roteiro', () => {
  it('tem pelo menos 10 exercicios de verdade', () => {
    expect(EXERCICIOS.length).toBeGreaterThanOrEqual(10);
  });

  it('e tambem as pausas: descanso, agua, celular e a troca de aparelho', () => {
    const ids = CENAS.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['descanso', 'agua', 'celular', 'troca']));
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

describe('poseNoTempo', () => {
  const cena = CENAS.find((c) => c.id === 'rosca')!;

  it('no comeco entrega o primeiro quadro', () => {
    expect(poseNoTempo(cena, 0)).toEqual(cena.quadros[0]);
  });

  it('entre dois quadros fica no meio do caminho, nunca fora', () => {
    // com 3 quadros, t=0.5 cai EXATAMENTE no quadro do meio; t=0.25 esta a caminho
    const m = poseNoTempo(cena, 0.25);
    const [a, b] = [cena.quadros[0].cotoveloE, cena.quadros[1].cotoveloE];
    expect(m.cotoveloE).toBeGreaterThan(Math.min(a, b));
    expect(m.cotoveloE).toBeLessThan(Math.max(a, b));
    expect(poseNoTempo(cena, 0.5)).toEqual(cena.quadros[1]);
  });

  it('o movimento desacelera nas pontas (nao e linear)', () => {
    const inicio = poseNoTempo(cena, 0.05).cotoveloE - poseNoTempo(cena, 0).cotoveloE;
    const meio = poseNoTempo(cena, 0.3).cotoveloE - poseNoTempo(cena, 0.25).cotoveloE;
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
    // mas anda na direcao certa
    expect(Math.abs(r.cotoveloE - atual.cotoveloE)).toBeGreaterThan(0);
  });

  it('o ombro acompanha o alvo na hora (so a ponta atrasa)', () => {
    const alvo = poseNoTempo(cena, 0.5);
    expect(comAtraso(poseNoTempo(cena, 0), alvo).ombroE).toBe(alvo.ombroE);
  });

  it('repetindo, a ponta alcanca o alvo', () => {
    const alvo = poseNoTempo(cena, 0.5);
    let p = poseNoTempo(cena, 0);
    for (let i = 0; i < 60; i++) p = comAtraso(p, alvo);
    expect(p.cotoveloE).toBeCloseTo(alvo.cotoveloE, 1);
  });
});

describe('esqueleto', () => {
  it('os ossos tem sempre o mesmo tamanho, em qualquer pose', () => {
    for (const cena of CENAS) {
      for (const t of [0, 0.25, 0.5, 0.75]) {
        const e = esqueletoDe(poseNoTempo(cena, t));
        expect(dist(e.ombro, e.cotoveloE), `${cena.id} braço`).toBeCloseTo(7, 5);
        expect(dist(e.cotoveloE, e.maoE), `${cena.id} antebraço`).toBeCloseTo(7, 5);
        expect(dist(e.quadril, e.joelhoD), `${cena.id} coxa`).toBeCloseTo(8, 5);
        expect(dist(e.joelhoD, e.peD), `${cena.id} canela`).toBeCloseTo(8, 5);
        expect(dist(e.quadril, e.ombro), `${cena.id} tronco`).toBeCloseTo(13, 5);
      }
    }
  });

  it('em pe, o ombro fica acima do quadril e os pes abaixo', () => {
    const e = esqueletoDe(poseNoTempo(CENAS.find((c) => c.id === 'descanso')!, 0));
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
  const CHAO = 46.2;

  it('em TODA cena e em TODO instante, o pe de apoio toca o chao', () => {
    // Era o defeito: o boneco ficava pendurado pelo quadril (base fixa) e os pes
    // eram deduzidos dos angulos. Ao agachar, a perna encurta -- entao o pe subia
    // e ele agachava no ar. Agora o desenho e assentado no chao.
    for (const cena of CENAS) {
      for (let i = 0; i <= 20; i++) {
        const p = poseNoTempo(cena, i / 20);
        const e = assentarNoChao(esqueletoDe(p), p.voo);
        const apoio = Math.max(e.peE.y, e.peD.y);
        expect(apoio, `${cena.id} em t=${i / 20}`).toBeCloseTo(CHAO - p.voo, 5);
      }
    }
  });

  it('nenhum pe atravessa o chao', () => {
    for (const cena of CENAS) {
      for (let i = 0; i <= 20; i++) {
        const p = poseNoTempo(cena, i / 20);
        const e = assentarNoChao(esqueletoDe(p), p.voo);
        expect(Math.max(e.peE.y, e.peD.y), `${cena.id}`).toBeLessThanOrEqual(CHAO + 0.001);
      }
    }
  });

  it('so quem pula sai do chao, e so no meio do movimento', () => {
    // panturrilha entra aqui porque o modelo nao tem tornozelo: para erguer o
    // calcanhar, sobe o corpo inteiro. E a aproximacao certa para este tamanho.
    const saltam = CENAS.filter((c) => c.quadros.some((q) => q.voo > 0)).map((c) => c.id);
    expect(saltam.sort()).toEqual(['corda', 'panturrilha', 'polichinelo']);
    for (const id of saltam) {
      const cena = CENAS.find((c) => c.id === id)!;
      expect(poseNoTempo(cena, 0).voo, `${id} comeca no chao`).toBe(0);
      expect(poseNoTempo(cena, 0.5).voo, `${id} no ar no meio`).toBeGreaterThan(1);
    }
  });

  it('assentar nao deforma: os ossos mantem o comprimento', () => {
    const p = poseNoTempo(CENAS.find((c) => c.id === 'agachamento')!, 0.5);
    const antes = esqueletoDe(p);
    const depois = assentarNoChao(antes, p.voo);
    expect(dist(depois.quadril, depois.joelhoE)).toBeCloseTo(dist(antes.quadril, antes.joelhoE), 10);
    expect(dist(depois.ombro, depois.cotoveloD)).toBeCloseTo(dist(antes.ombro, antes.cotoveloD), 10);
  });

  it('no agachamento o quadril DESCE de verdade', () => {
    const cena = CENAS.find((c) => c.id === 'agachamento')!;
    const emPe = assentarNoChao(esqueletoDe(poseNoTempo(cena, 0)), 0);
    const pFundo = poseNoTempo(cena, 0.5);
    const fundo = assentarNoChao(esqueletoDe(pFundo), pFundo.voo);
    // y cresce para baixo: agachado o quadril precisa estar MAIS BAIXO
    expect(fundo.quadril.y).toBeGreaterThan(emPe.quadril.y + 2);
  });
});

describe('correcoes de animacao (achadas na auditoria)', () => {
  it('o atraso nao depende mais da taxa de quadros do monitor', () => {
    // Antes, o mesmo fator rendia perseguicoes diferentes: a 144Hz o braco
    // chegava quase sem atraso, a 60Hz arrastava. Um passo de 100ms agora
    // equivale a seis passos de 1/60s.
    const alvo = poseNoTempo(CENAS[0], 0.5);
    const partida = poseNoTempo(CENAS[0], 0);

    let a60 = partida;
    for (let i = 0; i < 6; i++) a60 = comAtraso(a60, alvo, 0.22, 1000 / 60);
    const umPasso = comAtraso(partida, alvo, 0.22, 100);

    expect(umPasso.cotoveloE).toBeCloseTo(a60.cotoveloE, 6);
  });

  it('com quadro de duracao zero, nada se move', () => {
    const alvo = poseNoTempo(CENAS[0], 0.5);
    const partida = poseNoTempo(CENAS[0], 0);
    expect(comAtraso(partida, alvo, 0.22, 0).cotoveloE).toBe(partida.cotoveloE);
  });

  it('em t=1 entrega o ultimo quadro, nao um fio antes', () => {
    for (const cena of CENAS) {
      expect(poseNoTempo(cena, 1), `cena ${cena.id}`).toEqual(cena.quadros.at(-1));
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

  it('na rosca o cotovelo fica parado: e isso que diferencia de um arremesso', () => {
    const rosca = CENAS.find((c) => c.id === 'rosca')!;
    const ombros = rosca.quadros.map((q) => q.ombroE);
    expect(new Set(ombros).size, 'o ombro nao pode variar na rosca').toBe(1);

    const cotovelos = rosca.quadros.map((q) => {
      const e = assentarNoChao(esqueletoDe(q), q.voo);
      return e.cotoveloE;
    });
    for (const c of cotovelos.slice(1)) {
      expect(dist(c, cotovelos[0])).toBeLessThan(0.6);
    }
  });

  it('no agachamento as duas pernas sao espelhadas', () => {
    // pernas desiguais deixavam um pe abaixo do outro, e um unico deslocamento
    // vertical nao consegue assentar os dois
    const fundo = CENAS.find((c) => c.id === 'agachamento')!.quadros[1];
    expect(fundo.coxaE).toBe(-fundo.coxaD);
    expect(fundo.joelhoE).toBe(-fundo.joelhoD);
  });
});

describe('bracos invertidos: o defeito que o Joao viu na tela', () => {
  /*
   * Toda cena espelhava o lado direito (`ombroD = -ombroE`). De frente isso
   * esta certo. De perfil, nao: espelhar manda um braco para a FRENTE e o
   * outro para TRAS, e o boneco parecia fazer dois exercicios ao mesmo tempo.
   * Correr e beber agua sao as excecoes legitimas -- ali os dois bracos fazem
   * coisas diferentes de verdade.
   */
  const BRACOS_SEPARADOS = ['corrida', 'agua'];

  it('toda cena diz de que lado esta sendo vista', () => {
    for (const c of CENAS) {
      expect(['frente', 'lado'], `cena ${c.id}`).toContain(c.vista);
    }
  });

  it('de perfil os dois bracos vao para o mesmo lado', () => {
    const cenas = CENAS.filter((c) => c.vista === 'lado' && !BRACOS_SEPARADOS.includes(c.id));
    expect(cenas.length).toBeGreaterThan(3);
    for (const cena of cenas) {
      for (const q of cena.quadros) {
        const juntos = (a: number, b: number) => Math.sign(a) === Math.sign(b) || Math.abs(a - b) <= 12;
        expect(juntos(q.ombroE, q.ombroD), `${cena.id}: ombro ${q.ombroE} vs ${q.ombroD}`).toBe(true);
        expect(juntos(q.cotoveloE, q.cotoveloD), `${cena.id}: cotovelo ${q.cotoveloE} vs ${q.cotoveloD}`).toBe(true);
      }
    }
  });

  it('de frente, ao contrario, um braco e o espelho do outro', () => {
    for (const cena of CENAS.filter((c) => c.vista === 'frente')) {
      for (const q of cena.quadros) {
        expect(q.ombroD, `${cena.id} ombro`).toBe(-q.ombroE);
        expect(q.cotoveloD, `${cena.id} cotovelo`).toBe(-q.cotoveloE);
      }
    }
  });

  it('no topo da rosca a mao sobe ate o ombro, em vez de abrir para o lado', () => {
    // com o cotovelo em 128 o antebraco parava na horizontal: espantalho,
    // nao rosca. A mao tem de chegar na altura do ombro e fechar para dentro.
    const topo = assentarNoChao(esqueletoDe(CENAS.find((c) => c.id === 'rosca')!.quadros[1]), 0);
    expect(Math.abs(topo.maoE.y - topo.ombro.y), 'mao na altura do ombro').toBeLessThan(2);
    expect(Math.abs(topo.maoE.x - topo.ombro.x), 'mao nao abre mais que o cotovelo')
      .toBeLessThan(Math.abs(topo.cotoveloE.x - topo.ombro.x) + 3);
  });

  it('na elevacao lateral o braco sobe esticado, nao em trave de gol', () => {
    const alto = CENAS.find((c) => c.id === 'elevacao')!.quadros[1];
    expect(Math.abs(alto.cotoveloE), 'cotovelo quase reto').toBeLessThan(30);
    expect(Math.abs(alto.ombroE), 'braco na horizontal').toBeGreaterThan(75);
  });

  it('na remada o cotovelo sobe mais que o ombro: puxa para tras, nao empurra', () => {
    const cena = CENAS.find((c) => c.id === 'remada')!;
    const solto = assentarNoChao(esqueletoDe(cena.quadros[0]), 0);
    const puxado = assentarNoChao(esqueletoDe(cena.quadros[1]), 0);
    // y cresce para baixo: puxando, o cotovelo tem de SUBIR
    expect(puxado.cotoveloE.y).toBeLessThan(solto.cotoveloE.y - 5);
    // e a mao tem de chegar perto do tronco, nao ficar pendurada
    const aoTronco = (e: typeof puxado) =>
      Math.hypot(e.maoE.x - (e.quadril.x + e.ombro.x) / 2, e.maoE.y - (e.quadril.y + e.ombro.y) / 2);
    expect(aoTronco(puxado)).toBeLessThan(aoTronco(solto));
  });
});
