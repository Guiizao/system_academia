import { useEffect, useRef, useState } from 'react';
import {
  ALTURA_DO_APARELHO, ALTURA_DO_SUPORTE, MEIA_LARGURA_DO_SUPORTE,
  CENAS, CHAO_Y, MS_PEGAR, MOMENTO_DA_PEGADA, PARADO, PEGAR,
  arcoDaCorda, assentarNoChao, comAtraso, esqueletoDe, faseDaCorda, poseDosQuadros, poseNoTempo,
  type Pose, type Ponto,
} from '../dominio/boneco';
import './Bonequinho.css';

/**
 * O treino que nunca para, no canto da tela.
 *
 * Personagem proprio (nao e copia de ninguem). Cada junta tem angulo proprio e
 * o desenho e recalculado a cada quadro, com as pontas chegando atrasadas --
 * por isso o braco balanca em vez de girar inteiro como um graveto.
 *
 * Entre um exercicio e outro ele AGACHA E PEGA o aparelho que esta no chao, em
 * vez de o peso aparecer do nada na mao dele. Tudo para quando o aparelho pede
 * "reduzir movimento".
 */

/** Onde o aparelho espera, no suporte, antes de ele ir buscar. */
const APOIO = { x: 32, y: ALTURA_DO_APARELHO, meiaLargura: 5.6 };

/** Prolonga a reta mão→mão para a barra sobrar um pouco de cada lado. */
function pontaDaBarra(a: Ponto, b: Ponto, sobra = 3.2): [Ponto, Ponto] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const tam = Math.hypot(dx, dy) || 1;
  const ux = (dx / tam) * sobra;
  const uy = (dy / tam) * sobra;
  return [{ x: a.x - ux, y: a.y - uy }, { x: b.x + ux, y: b.y + uy }];
}

/** Ângulo do antebraço: o halter gira junto com o punho. */
function anguloDoPunho(cotovelo: Ponto, mao: Ponto): number {
  return (Math.atan2(mao.y - cotovelo.y, mao.x - cotovelo.x) * 180) / Math.PI;
}

type Fase = { tipo: 'pegando' | 'treinando'; cena: number };

export function Bonequinho() {
  const [fase, setFase] = useState<Fase>(() => ({ tipo: primeiraEhPegar(0) ? 'pegando' : 'treinando', cena: 0 }));
  const [pose, setPose] = useState<Pose>(PARADO);
  const [ciclo, setCiclo] = useState(0);        // 0..1 dentro da repetição, para a corda
  const [pegada, setPegada] = useState(false);  // já encostou no aparelho?
  const quadro = useRef(0);
  const poseRef = useRef<Pose>(pose);

  const cena = CENAS[fase.cena];

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const pegando = fase.tipo === 'pegando';
    const duracao = pegando ? MS_PEGAR : cena.cicloMs * cena.repeticoes;
    const inicio = performance.now();
    let vivo = true;
    let quadroAnterior = inicio;

    const passo = (agora: number) => {
      if (!vivo) return;
      const decorrido = agora - inicio;
      // quanto tempo passou DESDE O ÚLTIMO quadro: sem isso o atraso das pontas
      // muda conforme o monitor (60Hz na academia, 144Hz num PC gamer)
      const msDoQuadro = agora - quadroAnterior;
      quadroAnterior = agora;

      if (decorrido >= duracao) {
        if (pegando) { setPegada(true); setFase({ tipo: 'treinando', cena: fase.cena }); }
        else {
          const proxima = (fase.cena + 1) % CENAS.length;
          setPegada(false);
          setFase({ tipo: primeiraEhPegar(proxima) ? 'pegando' : 'treinando', cena: proxima });
        }
        return;
      }

      const t = pegando ? decorrido / duracao : (decorrido % cena.cicloMs) / cena.cicloMs;
      if (pegando && t >= MOMENTO_DA_PEGADA) setPegada(true);
      setCiclo(t);

      const alvo = pegando ? poseDosQuadros(PEGAR, t) : poseNoTempo(cena, t);
      // as pontas perseguem o alvo: é daqui que vem o "molenga"
      poseRef.current = comAtraso(poseRef.current, alvo, 0.18, msDoQuadro);
      setPose(poseRef.current);
      quadro.current = requestAnimationFrame(passo);
    };

    quadro.current = requestAnimationFrame(passo);
    return () => { vivo = false; cancelAnimationFrame(quadro.current); };
  }, [fase.tipo, fase.cena]);

  // assentar no chão é o que impede o boneco de agachar no ar: ele desce o
  // corpo inteiro até o pé de apoio encostar na linha desenhada abaixo
  const e = assentarNoChao(esqueletoDe(pose), pose.voo);
  const osso = (a: Ponto, b: Ponto, chave: string) => (
    <line key={chave} className="bn__osso" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
  );

  // enquanto ele não encostou a mão, o aparelho está no chão esperando
  const noChao = fase.tipo === 'pegando' && !pegada;
  const [apoioE, apoioD] = noChao
    ? [{ x: APOIO.x + APOIO.meiaLargura, y: APOIO.y },
       { x: APOIO.x - APOIO.meiaLargura, y: APOIO.y }]
    : [e.maoE, e.maoD];
  // a barra só volta para os ombros depois que ele a pegou e levantou
  const nosOmbros = fase.tipo === 'treinando' && cena.presoEm === 'ombros';
  const [pontaE, pontaD] = nosOmbros
    ? pontaDaBarra({ x: e.ombro.x - 9, y: e.ombro.y }, { x: e.ombro.x + 9, y: e.ombro.y }, 2)
    : pontaDaBarra(apoioE, apoioD);
  const giroE = noChao ? 90 : anguloDoPunho(e.cotoveloE, e.maoE);
  const giroD = noChao ? 90 : anguloDoPunho(e.cotoveloD, e.maoD);
  const fio = arcoDaCorda(e, faseDaCorda(ciclo));

  const legenda = fase.tipo === 'pegando'
    ? `Pegando o aparelho para ${cena.nome.toLowerCase()}`
    : `Treinando: ${cena.nome.toLowerCase()}`;

  return (
    <div className="bn" title={legenda} aria-hidden="true">
      <svg viewBox="-6 -8 76 62" className="bn__svg">
        {/* o chão é a referência: o boneco é assentado NELE, não o contrário */}
        <line className="bn__chao" x1="3" y1={CHAO_Y} x2="61" y2={CHAO_Y} />

        {/* pernas atrás do tronco, cada uma saindo do seu lado do quadril */}
        {osso(e.quadrilE, e.joelhoE, 'coxaE')}
        {osso(e.joelhoE, e.peE, 'canelaE')}
        {osso(e.quadrilD, e.joelhoD, 'coxaD')}
        {osso(e.joelhoD, e.peD, 'canelaD')}

        {/* tronco com largura: a linha do quadril e a dos ombros são o que
            separa os dois lados. Sem elas, parado, braços e tronco caíam na
            mesma reta e as juntas ficavam uma dentro da outra. */}
        {osso(e.quadrilD, e.quadrilE, 'quadril')}
        {osso(e.quadril, e.ombro, 'tronco')}
        {osso(e.ombroD, e.ombroE, 'ombros')}
        <circle className="bn__cabeca" cx={e.cabeca.x} cy={e.cabeca.y} r="4.2" />

        {osso(e.ombroE, e.cotoveloE, 'bracoE')}
        {osso(e.cotoveloE, e.maoE, 'antebracoE')}
        {osso(e.ombroD, e.cotoveloD, 'bracoD')}
        {osso(e.cotoveloD, e.maoD, 'antebracoD')}

        {/* o suporte onde o peso descansa, enquanto ele nao pegou */}
        {noChao && (
          <line className="bn__suporte"
                x1={APOIO.x - MEIA_LARGURA_DO_SUPORTE} y1={ALTURA_DO_SUPORTE}
                x2={APOIO.x + MEIA_LARGURA_DO_SUPORTE} y2={ALTURA_DO_SUPORTE} />
        )}

        {/* o aparelho nasce NA mao -- ou no suporte, enquanto ele vai buscar */}
        <g className="bn__aparelho">
          {cena.aparelho === 'barra' && (
            <>
              <line className="bn__barra" x1={pontaE.x} y1={pontaE.y} x2={pontaD.x} y2={pontaD.y} />
              <circle className="bn__anilha" cx={pontaE.x} cy={pontaE.y} r="2.6" />
              <circle className="bn__anilha" cx={pontaD.x} cy={pontaD.y} r="2.6" />
            </>
          )}

          {cena.aparelho === 'corda' && (
            noChao
              ? <path className="bn__corda"
                      d={`M ${apoioD.x} ${apoioD.y} Q ${APOIO.x} ${APOIO.y + 3} ${apoioE.x} ${apoioE.y}`} />
              : <path className="bn__corda" style={{ opacity: fio.opacidade }} d={fio.d} />
          )}

          {cena.aparelho === 'halteres' && (
            <>
              <g transform={`translate(${apoioE.x} ${apoioE.y}) rotate(${giroE})`}>
                <rect className="bn__halter" x="-1.2" y="-3.1" width="2.4" height="6.2" rx="1" />
              </g>
              <g transform={`translate(${apoioD.x} ${apoioD.y}) rotate(${giroD})`}>
                <rect className="bn__halter" x="-1.2" y="-3.1" width="2.4" height="6.2" rx="1" />
              </g>
            </>
          )}

          {cena.aparelho === 'garrafa' && (
            <g transform={`translate(${apoioD.x} ${apoioD.y}) rotate(${giroD})`}>
              <rect className="bn__garrafa" x="-1.5" y="-3.4" width="3" height="6.6" rx="1.2" />
            </g>
          )}

          {cena.aparelho === 'celular' && (
            <g transform={`translate(${apoioD.x} ${apoioD.y}) rotate(${giroD})`}>
              <rect className="bn__celular" x="-1.7" y="-2.6" width="3.4" height="5.2" rx="1" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}

/** Exercício sem aparelho não tem o que buscar: entra direto. */
function primeiraEhPegar(indice: number): boolean {
  return CENAS[indice].aparelho !== 'nenhum';
}
