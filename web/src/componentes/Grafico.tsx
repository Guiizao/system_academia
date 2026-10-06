import { escalaDeBarras } from '../dominio/grafico';
import './Grafico.css';

/**
 * Graficos do sistema. Barras de UMA cor so: a categoria ja esta escrita do
 * lado, entao pintar cada uma de um jeito nao informa nada e so polui.
 * O numero exato aparece no hover (e no rotulo, quando cabe).
 */

export interface Ponto {
  rotulo: string;
  valor: number;
  /** linha extra do balao (ex.: "3 pagamentos") */
  detalhe?: string;
  destaque?: boolean;
}

/** Barras em pe: serve para o tempo (meses), que se le da esquerda para a direita. */
export function BarrasVerticais({ dados, formatar, altura = 132 }: {
  dados: Ponto[]; formatar: (v: number) => string; altura?: number;
}) {
  const escala = escalaDeBarras(dados.map((d) => d.valor));
  if (!dados.length) return <p className="grafico__vazio">Sem dados neste período.</p>;

  return (
    <div className="grafico grafico--vertical" style={{ ['--altura' as string]: `${altura}px` }}>
      {dados.map((d) => (
        <div key={d.rotulo} className={`gv ${d.destaque ? 'gv--destaque' : ''}`}>
          <div className="gv__trilho">
            <div className="gv__barra" style={{ height: `${escala.pct(d.valor)}%` }} />
            <span className="grafico__balao" role="tooltip">
              <b>{formatar(d.valor)}</b>{d.detalhe ? <small>{d.detalhe}</small> : null}
            </span>
          </div>
          <span className="gv__rotulo">{d.rotulo}</span>
        </div>
      ))}
      <span className="so-leitor">
        {dados.map((d) => `${d.rotulo}: ${formatar(d.valor)}`).join('. ')}
      </span>
    </div>
  );
}

/** Barras deitadas: serve para ranking com nome (formas de pagamento, planos). */
export function BarrasHorizontais({ dados, formatar }: {
  dados: Ponto[]; formatar: (v: number) => string;
}) {
  const escala = escalaDeBarras(dados.map((d) => d.valor));
  if (!dados.length) return <p className="grafico__vazio">Sem dados neste período.</p>;

  return (
    <div className="grafico grafico--horizontal">
      {dados.map((d) => (
        <div key={d.rotulo} className="gh">
          <span className="gh__rotulo">{d.rotulo}</span>
          <div className="gh__trilho">
            <div className="gh__barra" style={{ width: `${escala.pct(d.valor)}%` }} />
          </div>
          <span className="gh__valor num">{formatar(d.valor)}</span>
          {d.detalhe && <span className="gh__detalhe">{d.detalhe}</span>}
        </div>
      ))}
    </div>
  );
}
