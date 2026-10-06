import { useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao, pode } from '../sessao';
import { formatarBRL, formatarData, diffDias, hoje } from '../dominio';
import { mesCurto, variacaoTexto } from '../dominio/grafico';
import { IconeAlerta } from '../componentes/Icones';
import { BarrasVerticais, BarrasHorizontais } from '../componentes/Grafico';
import { Painel } from '../componentes/Painel';
import { FormPagamento } from './FormPagamento';
import { FormPlano } from './FormPlano';
import { RelatorioMes } from './RelatorioMes';
import { mover, podeMover } from '../dominio/ordem';
import type { Aluno, Plano } from '../tipos';
import './Financeiro.css';

/** "/mes", "/3 meses", "/dia", "/5 dias" -- o que o cliente le no cartao */
function sufixoDuracao(p: Plano): string {
  if (p.duracaoDias != null) return p.duracaoDias === 1 ? '/dia' : `/${p.duracaoDias} dias`;
  return p.duracaoMeses === 1 ? '/mês' : `/${p.duracaoMeses} meses`;
}

const FORMA: Record<string, string> = { pix: 'Pix', dinheiro: 'dinheiro', debito: 'débito', credito: 'crédito', boleto: 'boleto' };

export function Financeiro() {
  const { usuario, avisar } = useSessao();
  const dono = pode.verFinanceiro(usuario);
  const { dados: cobrancas, recarregar: recCob } = useDados(() => api.cobrancas(), []);
  const { dados: pagamentos, recarregar: recPag } = useDados(() => api.pagamentos(), []);
  const [verDesativados, setVerDesativados] = useState(false);
  const { dados: planos, recarregar: recPlanos } =
    useDados(() => api.planos(dono && verDesativados), [dono, verDesativados]);
  const { dados: resumo } = useDados(() => (dono ? api.dashboard() : Promise.resolve(null)), [dono]);
  const { dados: rel, recarregar: recRel } = useDados(() => (dono ? api.relatorioFinanceiro() : Promise.resolve(null)), [dono]);
  const [editandoPlano, setEditandoPlano] = useState<Plano | null>(null);
  const [criandoPlano, setCriandoPlano] = useState(false);
  const [verRelatorio, setVerRelatorio] = useState(false);
  /** ordem mostrada enquanto o servidor grava: a seta responde na hora */
  const [ordemLocal, setOrdemLocal] = useState<Plano[] | null>(null);
  const [pagando, setPagando] = useState<Aluno | null>(null);

  const H = hoje();
  const emAberto = cobrancas ?? [];
  const totalAberto = emAberto.reduce((s, c) => s + c.valorCentavos, 0);
  const atrasadas = emAberto.filter((c) => diffDias(H, c.vencimento) < 0);
  const variacao = variacaoTexto(rel?.variacaoPct ?? null);

  const lista = ordemLocal ?? planos ?? [];

  async function trocarOrdem(indice: number, direcao: -1 | 1) {
    const nova = mover(lista, indice, indice + direcao);
    setOrdemLocal(nova);
    try {
      await api.ordenarPlanos(nova.map((p) => p.id));
      await recPlanos();
    } catch (err: any) {
      avisar(err.message, 'erro');
    } finally {
      setOrdemLocal(null);
    }
  }

  async function abrirPagamento(alunoId: number) {
    setPagando(await api.aluno(alunoId));
  }

  return (
    <div className="container entrar">
      <div className="sec-head">
        <h2>Financeiro</h2>
        {dono && rel && (
          <button className="btn btn-secondary btn-sm" onClick={() => setVerRelatorio(true)}>
            Relatório de {rel.mesPorExtenso.split(' de ')[0]}
          </button>
        )}
      </div>

      {dono && resumo && (
        <div className="fin__cartoes escalonar">
          <Cartao rotulo="Recebido no mês" valor={formatarBRL(resumo.receitaMesCentavos!)}
                  sub={variacao?.texto} tomSub={variacao?.tom} />
          <Cartao rotulo="A receber" valor={formatarBRL(resumo.inadimplenciaCentavos!)} tom="danger"
                  sub={`${resumo.vencidos} ${resumo.vencidos === 1 ? 'aluno vencido' : 'alunos vencidos'}`} />
          <Cartao rotulo="Recebido hoje" valor={formatarBRL(resumo.recebidoHojeCentavos!)} tom="ok" />
          <Cartao rotulo="Ticket médio" valor={formatarBRL(rel?.ticketMedioCentavos ?? 0)}
                  sub={rel ? `${rel.pagamentos} ${rel.pagamentos === 1 ? 'pagamento' : 'pagamentos'} no mês` : undefined} />
        </div>
      )}

      {/* Listas fechadas por padrao: a tela abre mostrando o resumo, nao um rolo
          de nomes. Quem precisa da lista abre com um clique. */}
      <Painel
        titulo="Cobranças em aberto"
        resumo={emAberto.length
          ? `${emAberto.length} ${emAberto.length === 1 ? 'pessoa' : 'pessoas'}, ${formatarBRL(totalAberto)}`
          : 'Ninguém em aberto'}
        alerta={atrasadas.length ? `${atrasadas.length} vencida${atrasadas.length === 1 ? '' : 's'}` : undefined}
        quantidade={emAberto.length}
      >
        {emAberto.map((c) => {
          const dias = diffDias(H, c.vencimento);
          const atrasada = dias < 0;
          return (
            <div key={c.id} className="cobranca">
              <div className="cobranca__info">
                <div className="cobranca__nome">{c.alunoNome}</div>
                <div className={`cobranca__venc ${atrasada ? 'grave' : ''}`}>
                  {atrasada ? `Vencida há ${-dias} ${-dias === 1 ? 'dia' : 'dias'}`
                    : dias === 0 ? 'Vence hoje' : dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`}
                  {`, ${formatarData(c.vencimento)}`}
                </div>
              </div>
              <strong className={atrasada ? 'valor-danger' : ''}>{formatarBRL(c.valorCentavos)}</strong>
              <button className="btn btn-sm btn-secondary" onClick={() => abrirPagamento(c.alunoId)}>Receber</button>
            </div>
          );
        })}
      </Painel>

      <Painel
        titulo="Pagamentos recentes"
        resumo={pagamentos?.length ? `${pagamentos.length} ${pagamentos.length === 1 ? 'registro' : 'registros'}` : 'Nenhum pagamento ainda'}
        quantidade={pagamentos?.length ?? 0}
      >
        {pagamentos?.slice(0, 20).map((p) => (
          <div key={p.id} className="tabela__linha">
            <div>
              <div className="tabela__forte">{p.alunoNome}</div>
              <div className="tabela__fraco">
                {formatarData(p.dataPagamento)}, {FORMA[p.forma] ?? p.forma}{p.observacao ? `, ${p.observacao}` : ''}
              </div>
            </div>
            <strong className="valor-ok">+{formatarBRL(p.valorCentavos)}</strong>
          </div>
        ))}
      </Painel>

      {dono && rel && (
        <div className="fin__graficos">
          <section className="card card--grafico">
            <h3>Receita dos últimos 6 meses</h3>
            <BarrasVerticais
              dados={rel.serie.map((s) => ({
                rotulo: mesCurto(s.mes, s.mes.endsWith('-01')),
                valor: s.totalCentavos,
                detalhe: `${s.pagamentos} ${s.pagamentos === 1 ? 'pagamento' : 'pagamentos'}`,
                destaque: s.mes === rel.mes,
              }))}
              formatar={formatarBRL}
            />
          </section>

          <section className="card card--grafico">
            <h3>Alunos por plano</h3>
            <BarrasHorizontais
              dados={rel.porPlano.map((p) => ({ rotulo: p.plano, valor: p.alunos }))}
              formatar={(v) => String(v)}
            />
          </section>
        </div>
      )}

      <div className="sec-head">
        <h2>Planos</h2>
        {dono && (
          <div className="sec-head__acoes">
            <button className="btn btn-secondary btn-sm" aria-pressed={verDesativados}
                    onClick={() => setVerDesativados((v) => !v)}>
              {verDesativados ? 'Esconder desativados' : 'Ver desativados'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setCriandoPlano(true)}>Novo plano</button>
          </div>
        )}
      </div>
      <div className="planos">
        {lista.map((p, i) => (
          <div key={p.id} className={`plano ${p.destaque ? 'destaque' : ''} ${p.ativo ? '' : 'plano--inativo'}`}>
            {!p.ativo
              ? <span className="plano__tag plano__tag--off">Desativado</span>
              : p.destaque && <span className="plano__tag">Popular</span>}
            <div className="plano__nome">{p.nome}</div>
            <div className="plano__preco">
              {formatarBRL(p.precoCentavos)}<small>{sufixoDuracao(p)}</small>
            </div>
            {p.beneficios.map((b) => <div key={b} className="plano__item">{b}</div>)}
            {dono && (
              <div className="plano__rodape">
                <button className="btn btn-secondary btn-sm" onClick={() => setEditandoPlano(p)}>Editar</button>
                <div className="plano__ordem">
                  <button className="btn-ordem" aria-label={`Mover ${p.nome} para antes`}
                          disabled={!podeMover(i, lista.length, -1)} onClick={() => trocarOrdem(i, -1)}>↑</button>
                  <button className="btn-ordem" aria-label={`Mover ${p.nome} para depois`}
                          disabled={!podeMover(i, lista.length, 1)} onClick={() => trocarOrdem(i, 1)}>↓</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!lista.length && <div className="vazio"><strong>Nenhum plano cadastrado</strong>Crie o primeiro em "Novo plano".</div>}
      </div>

      <div className="pix-nota">
        <IconeAlerta size={15} />
        <div>
          <strong>A confirmação do Pix é manual</strong>
          A chave estática gera o QR, mas não avisa quando o dinheiro cai. Confirme conferindo o
          <b> extrato do banco</b>, nunca pelo print do aluno.
        </div>
      </div>

      {(editandoPlano || criandoPlano) && (
        <FormPlano plano={editandoPlano} aoFechar={() => { setEditandoPlano(null); setCriandoPlano(false); }}
                   aoSalvar={() => { setEditandoPlano(null); setCriandoPlano(false); recPlanos(); recRel(); }} />
      )}
      {verRelatorio && rel && <RelatorioMes relatorio={rel} aoFechar={() => setVerRelatorio(false)} />}
      {pagando && (
        <FormPagamento aluno={pagando} aoFechar={() => setPagando(null)}
                       aoPagar={() => { setPagando(null); recCob(); recPag(); recRel(); }} />
      )}
    </div>
  );
}

function Cartao({ rotulo, valor, sub, tom, tomSub }: {
  rotulo: string; valor: string; sub?: string; tom?: string; tomSub?: string;
}) {
  return (
    <div className="fin-cartao">
      <div className="fin-cartao__rot">{rotulo}</div>
      <div className={`fin-cartao__val ${tom ? `t-${tom}` : ''}`}>{valor}</div>
      {sub && <div className={`fin-cartao__sub ${tomSub ? `t-${tomSub}` : ''}`}>{sub}</div>}
    </div>
  );
}
