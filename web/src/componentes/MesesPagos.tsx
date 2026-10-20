import type { CSSProperties } from 'react';
import { formatarData, hoje } from '../dominio';
import { mesesPagos, resumoPagos, trechoPago, type Periodo } from '../dominio/meses-pagos';
import type { StatusAluno } from '../tipos';

/** Linha do tempo dos meses pagos, na aba Pagamentos do aluno. */
export function MesesPagos({ periodos, status }: { periodos: Periodo[]; status: StatusAluno }) {
  const h = hoje();
  const meses = mesesPagos(periodos, h, status);
  if (!meses.length) return null;

  const resumo = resumoPagos(periodos, h);
  const trecho = trechoPago(periodos);
  const descricao = `Pago de ${formatarData(trecho!.de)} a ${formatarData(trecho!.ate)}.${resumo.startsWith('Venceu') ? ` ${resumo}.` : ''}`;
  const temVencido = meses.some((m) => m.faixas.some((f) => f.tipo === 'vencido'));

  return (
    <section className="meses-pagos">
      <div className="meses-pagos__cab">
        <h3>Meses pagos</h3>
        {/* vermelho só para quem deve; o inativo saiu, o resumo dele fica neutro */}
        <span className={`meses-pagos__resumo ${resumo.startsWith('Pago') ? '' : status === 'vencido' ? 'grave' : 'neutro'}`}>{resumo}</span>
      </div>
      <div className="meses-pagos__linha" role="img" aria-label={descricao}>
        {meses.map((m, i) => (
          <div key={m.mes} className={`mp-mes ${m.hoje !== null ? 'mp-mes--hoje' : ''}`} style={{ '--i': i } as CSSProperties}>
            <div className="mp-mes__barra">
              {m.faixas.map((f) => (
                <span key={`${f.tipo}${f.de}`} className={`mp-faixa mp-faixa--${f.tipo}`}
                      style={{ left: `${f.de * 100}%`, width: `${(f.ate - f.de) * 100}%` }} />
              ))}
              {m.hoje !== null && <span className="mp-mes__hoje" style={{ left: `${m.hoje * 100}%` }} />}
            </div>
            <span className="mp-mes__nome">{m.rotulo}</span>
            {m.ano && <span className="mp-mes__ano">{m.ano}</span>}
          </div>
        ))}
      </div>
      <div className="meses-pagos__legenda" aria-hidden="true">
        <span><i className="mp-ponto mp-faixa--pago" />Pago</span>
        {temVencido && <span><i className="mp-ponto mp-faixa--vencido" />Vencido</span>}
        <span><i className="mp-ponto mp-ponto--hoje" />Hoje</span>
      </div>
    </section>
  );
}
