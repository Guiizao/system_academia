import { useEffect, useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { hoje } from '../dominio';
import { BarrasVerticais } from '../componentes/Grafico';
import { ListaPagamentos } from '../componentes/Pagamentos';
import { Olho, useValores } from '../componentes/Valores';
import type { FormaPagamento } from '../tipos';

/**
 * Histórico completo: TODOS os pagamentos de cada mês, sem o corte de 30 da
 * lista antiga. Escolhe o mês pelas setas ou clicando na barra do gráfico.
 * Digitando um nome, a busca passa a valer para todos os meses -- é o "esse
 * aluno pagou quando?" que o balcão pergunta.
 */

const ROTULO_FORMA: Record<FormaPagamento, string> = { pix: 'Pix', dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito', boleto: 'Boleto' };

/** 'AAAA-MM' andando n meses para a frente (ou para trás). */
function somarMes(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesPorExtenso(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  const t = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const mesCurto = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};

export function HistoricoPagamentos({ versao = 0, aoMudar }: {
  versao?: number;
  /** editou ou excluiu: quem mostra os totais do caixa recarrega junto */
  aoMudar?: () => void;
}) {
  const { formatar: dinheiro } = useValores();
  const mesAtual = hoje().slice(0, 7);
  const [mes, setMes] = useState(mesAtual);
  const [digitado, setDigitado] = useState('');
  const [busca, setBusca] = useState('');

  // espera a pessoa parar de digitar: sem isso cada letra viraria uma consulta
  useEffect(() => {
    const t = setTimeout(() => setBusca(digitado.trim()), 300);
    return () => clearTimeout(t);
  }, [digitado]);

  const buscando = busca.length > 0;
  const { dados, carregando, erro, recarregar } = useDados(
    () => api.historicoPagamentos(buscando ? { busca } : { mes }), [mes, busca, versao]);

  const meses = dados?.meses ?? [];
  const pontos = meses.map((m) => ({
    rotulo: mesCurto(m.mes), valor: m.totalCentavos, destaque: !buscando && m.mes === mes,
    detalhe: `${m.quantidade} ${m.quantidade === 1 ? 'pagamento' : 'pagamentos'}`,
  }));

  return (
    <section className="historico">
      <div className="historico__cab">
        <div>
          <h3>Histórico de pagamentos<Olho /></h3>
          <p>Todos os pagamentos, mês a mês. Clique numa barra para ver o mês.</p>
        </div>
        <div className="busca historico__busca">
          <input type="search" placeholder="Buscar aluno em todos os meses" value={digitado}
                 onChange={(e) => setDigitado(e.target.value)} aria-label="Buscar pagamentos por nome do aluno" />
        </div>
      </div>

      {pontos.length > 0 && (
        <BarrasVerticais dados={pontos} formatar={dinheiro} altura={96}
                         aoEscolher={(i) => { setDigitado(''); setBusca(''); setMes(meses[i].mes); }} />
      )}

      <div className="historico__mes">
        {buscando ? (
          <strong>Pagamentos de “{busca}”, em todos os meses</strong>
        ) : (
          <div className="historico__setas">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMes((m) => somarMes(m, -1))}
                    aria-label="Mês anterior">‹</button>
            <strong>{mesPorExtenso(mes)}</strong>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMes((m) => somarMes(m, 1))}
                    disabled={mes >= mesAtual} aria-label="Próximo mês">›</button>
          </div>
        )}
        {dados && (
          <div className="historico__totais">
            <span><b>{dinheiro(dados.totalCentavos)}</b> em {dados.quantidade} {dados.quantidade === 1 ? 'pagamento' : 'pagamentos'}</span>
            {dados.porForma.map((f) => (
              <span key={f.forma} className="historico__forma">{ROTULO_FORMA[f.forma] ?? f.forma} {dinheiro(f.totalCentavos)}</span>
            ))}
          </div>
        )}
      </div>

      <div className="historico__lista">
        {erro ? <div className="erro-carga">{erro}</div>
          : carregando && !dados ? <div className="carregando">Carregando…</div>
          : !dados?.itens.length ? (
            <div className="vazio">{buscando ? `Nenhum pagamento de “${busca}”.` : 'Nenhum pagamento neste mês.'}</div>
          ) : (
            <ListaPagamentos itens={dados.itens} mostrarAluno aoMudar={() => { recarregar(); aoMudar?.(); }} />
          )}
      </div>
    </section>
  );
}
