import { useEffect, useRef, useState } from 'react';
import { CENAS, CHAO_Y, assentarNoChao, poseNoTempo, comAtraso, esqueletoDe, type Pose, type Ponto } from '../dominio/boneco';
import './Bonequinho.css';

/**
 * O treino que nunca para, no canto da tela.
 *
 * Personagem proprio (nao e copia de ninguem). Cada junta tem angulo proprio e
 * o desenho e recalculado a cada quadro, com as pontas chegando atrasadas --
 * por isso o braco balanca em vez de girar inteiro como um graveto.
 *
 * Entre um exercicio e outro ele ARRASTA o aparelho para fora e puxa o
 * proximo. Tudo para quando o aparelho pede "reduzir movimento".
 */

const DURACAO_TROCA = 900;

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

export function Bonequinho() {
  const [cenaIdx, setCenaIdx] = useState(0);
  const [pose, setPose] = useState<Pose>(() => poseNoTempo(CENAS[0], 0));
  const [trocando, setTrocando] = useState(false);
  const quadro = useRef(0);
  const poseRef = useRef<Pose>(pose);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const cena = CENAS[cenaIdx];
    const inicio = performance.now();
    const duracaoCena = cena.cicloMs * cena.repeticoes;
    let vivo = true;
    let troca: number | undefined;

    let quadroAnterior = inicio;
    const passo = (agora: number) => {
      if (!vivo) return;
      const decorrido = agora - inicio;
      // quanto tempo passou DESDE O ÚLTIMO quadro: sem isso o atraso das pontas
      // muda conforme o monitor (60Hz na academia, 144Hz num PC gamer)
      const msDoQuadro = agora - quadroAnterior;
      quadroAnterior = agora;

      if (decorrido >= duracaoCena) {
        // fim da série: o aparelho sai arrastado antes do próximo exercício
        setTrocando(true);
        troca = window.setTimeout(() => {
          if (!vivo) return;
          setTrocando(false);
          setCenaIdx((i) => (i + 1) % CENAS.length);
        }, DURACAO_TROCA);
        return;
      }

      const t = (decorrido % cena.cicloMs) / cena.cicloMs;
      // as pontas perseguem o alvo: é daqui que vem o "molenga"
      poseRef.current = comAtraso(poseRef.current, poseNoTempo(cena, t), 0.22, msDoQuadro);
      setPose(poseRef.current);
      quadro.current = requestAnimationFrame(passo);
    };

    quadro.current = requestAnimationFrame(passo);
    return () => { vivo = false; cancelAnimationFrame(quadro.current); window.clearTimeout(troca); };
  }, [cenaIdx]);

  const cena = CENAS[cenaIdx];
  // assentar no chão é o que impede o boneco de agachar no ar: ele desce o
  // corpo inteiro até o pé de apoio encostar na linha desenhada abaixo
  const e = assentarNoChao(esqueletoDe(pose), pose.voo);
  const osso = (a: Ponto, b: Ponto, chave: string) => (
    <line key={chave} className="bn__osso" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
  );
  // barra: linha de uma mão à outra (ou atravessada nos ombros, no agachamento)
  const [pontaE, pontaD] = cena.presoEm === 'ombros'
    ? pontaDaBarra({ x: e.ombro.x - 9, y: e.ombro.y }, { x: e.ombro.x + 9, y: e.ombro.y }, 2)
    : pontaDaBarra(e.maoE, e.maoD);

  return (
    <div className={`bn ${trocando ? 'bn--trocando' : ''}`} title={`Treinando: ${cena.nome.toLowerCase()}`} aria-hidden="true">
      <svg viewBox="-6 -8 76 62" className="bn__svg">
        {/* o chão é a referência: o boneco é assentado NELE, não o contrário */}
        <line className="bn__chao" x1="3" y1={CHAO_Y} x2="61" y2={CHAO_Y} />

        {/* pernas atrás do tronco */}
        {osso(e.quadril, e.joelhoE, 'coxaE')}
        {osso(e.joelhoE, e.peE, 'canelaE')}
        {osso(e.quadril, e.joelhoD, 'coxaD')}
        {osso(e.joelhoD, e.peD, 'canelaD')}

        {osso(e.quadril, e.ombro, 'tronco')}
        <circle className="bn__cabeca" cx={e.cabeca.x} cy={e.cabeca.y} r="4.2" />

        {osso(e.ombro, e.cotoveloE, 'bracoE')}
        {osso(e.cotoveloE, e.maoE, 'antebracoE')}
        {osso(e.ombro, e.cotoveloD, 'bracoD')}
        {osso(e.cotoveloD, e.maoD, 'antebracoD')}

        {/* o aparelho nasce NA mão: antes eu desenhava no ponto médio e os
            pesos pareciam soltos no ar quando os braços abriam */}
        <g className="bn__aparelho">
          {(cena.aparelho === 'barra' || cena.aparelho === 'corda') && (
            <>
              {cena.aparelho === 'barra' ? (
                <>
                  <line className="bn__barra" x1={pontaE.x} y1={pontaE.y} x2={pontaD.x} y2={pontaD.y} />
                  <circle className="bn__anilha" cx={pontaE.x} cy={pontaE.y} r="2.6" />
                  <circle className="bn__anilha" cx={pontaD.x} cy={pontaD.y} r="2.6" />
                </>
              ) : (
                <path className="bn__corda"
                      d={`M ${e.maoE.x} ${e.maoE.y} Q ${(e.maoE.x + e.maoD.x) / 2} ${Math.max(e.peE.y, e.peD.y) + 5} ${e.maoD.x} ${e.maoD.y}`} />
              )}
            </>
          )}

          {cena.aparelho === 'halteres' && (
            <>
              <g transform={`translate(${e.maoE.x} ${e.maoE.y}) rotate(${anguloDoPunho(e.cotoveloE, e.maoE)})`}>
                <rect className="bn__halter" x="-1.2" y="-3.1" width="2.4" height="6.2" rx="1" />
              </g>
              <g transform={`translate(${e.maoD.x} ${e.maoD.y}) rotate(${anguloDoPunho(e.cotoveloD, e.maoD)})`}>
                <rect className="bn__halter" x="-1.2" y="-3.1" width="2.4" height="6.2" rx="1" />
              </g>
            </>
          )}

          {cena.aparelho === 'garrafa' && (
            <g transform={`translate(${e.maoD.x} ${e.maoD.y}) rotate(${anguloDoPunho(e.cotoveloD, e.maoD)})`}>
              <rect className="bn__garrafa" x="-1.5" y="-3.4" width="3" height="6.6" rx="1.2" />
            </g>
          )}

          {cena.aparelho === 'celular' && (
            <g transform={`translate(${e.maoD.x} ${e.maoD.y}) rotate(${anguloDoPunho(e.cotoveloD, e.maoD)})`}>
              <rect className="bn__celular" x="-1.7" y="-2.6" width="3.4" height="5.2" rx="1" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
