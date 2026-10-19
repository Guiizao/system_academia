import { useCallback, useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao, pode } from '../sessao';
import { formatarData, diffDias, hoje, contem, ROTULO_FORMA } from '../dominio';
import { Olho, useValores } from '../componentes/Valores';
import { Contagem } from '../componentes/Contagem';
import { TodosPagamentos } from './TodosPagamentos';
import { mesCurto, variacaoTexto } from '../dominio/grafico';
import { IconeAlerta } from '../componentes/Icones';
import { BarrasVerticais } from '../componentes/Grafico';
import { Secao, SubTela } from '../componentes/Secao';
import { FormPagamento } from './FormPagamento';
import { FormPlano } from './FormPlano';
import { RelatorioMes } from './RelatorioMes';
import { mover, podeMover } from '../dominio/ordem';
import type { Aluno, Cobranca, Plano } from '../tipos';
import './Financeiro.css';

/**
 * Financeiro em duas camadas. A tela abre no RESUMO: os números do mês e uma
 * prévia curta de cada assunto (receita, cobranças, pagamentos, planos), sem
 * repetir nada. Cada prévia tem o botão para o painel completo dela, onde
 * moram a lista inteira, a busca, os filtros e as ações.
 */

type Vista = 'resumo' | 'pagamentos' | 'cobrancas' | 'planos';

/** "/mes", "/3 meses", "/dia", "/5 dias" -- o que o cliente le no cartao */
function sufixoDuracao(p: Plano): string {
  if (p.duracaoDias != null) return p.duracaoDias === 1 ? '/dia' : `/${p.duracaoDias} dias`;
  return p.duracaoMeses === 1 ? '/mês' : `/${p.duracaoMeses} meses`;
}

function quandoVence(c: Cobranca, H: string): { texto: string; atrasada: boolean } {
  const dias = diffDias(H, c.vencimento);
  if (dias < 0) return { texto: `Vencida há ${-dias} ${-dias === 1 ? 'dia' : 'dias'}`, atrasada: true };
  return { texto: dias === 0 ? 'Vence hoje' : dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`, atrasada: false };
}

export function Financeiro() {
  // o olho vale para o sistema inteiro: esconder aqui esconde em todas as telas
  const { formatar: dinheiro } = useValores();
  const { usuario, avisar } = useSessao();
  const dono = pode.verFinanceiro(usuario);
  const [vista, setVista] = useState<Vista>('resumo');
  const [mesAberto, setMesAberto] = useState<string | undefined>();

  const { dados: cobrancas, recarregar: recCob } = useDados(() => api.cobrancas(), []);
  const { dados: ultimos, recarregar: recUltimos } = useDados(() => api.historicoPagamentos({ porPagina: 5 }), []);
  const { dados: planosAtivos, recarregar: recAtivos } = useDados(() => api.planos(), []);
  const { dados: resumo, recarregar: recResumo } = useDados(() => (dono ? api.dashboard() : Promise.resolve(null)), [dono]);
  const { dados: rel, recarregar: recRel } = useDados(() => (dono ? api.relatorioFinanceiro() : Promise.resolve(null)), [dono]);
  // pagar, editar ou excluir mexe no caixa todo: cartões, cobranças, prévias e relatório
  const recarregarCaixa = useCallback(() => { recCob(); recUltimos(); recResumo(); recRel(); }, [recCob, recUltimos, recResumo, recRel]);
  const [verRelatorio, setVerRelatorio] = useState(false);
  const [pagando, setPagando] = useState<Aluno | null>(null);
  const voltar = useCallback(() => setVista('resumo'), []);

  const H = hoje();
  const emAberto = cobrancas ?? [];
  const totalAberto = emAberto.reduce((s, c) => s + c.valorCentavos, 0);
  const atrasadas = emAberto.filter((c) => diffDias(H, c.vencimento) < 0);
  const variacao = variacaoTexto(rel?.variacaoPct ?? null);
  const alunosNoPlano = (nome: string) => rel?.porPlano.find((p) => p.plano === nome)?.alunos ?? 0;

  async function abrirPagamento(alunoId: number) {
    setPagando(await api.aluno(alunoId));
  }

  const janelas = (
    <>
      {verRelatorio && rel && <RelatorioMes relatorio={rel} aoFechar={() => setVerRelatorio(false)} />}
      {pagando && (
        <FormPagamento aluno={pagando} aoFechar={() => setPagando(null)}
                       aoPagar={() => { setPagando(null); recarregarCaixa(); }} />
      )}
    </>
  );

  // o painel completo entra no lugar do resumo; a chave refaz a entrada animada
  if (vista !== 'resumo') {
    return (
      <div className="container entrar-fundo" key={vista}>
        {vista === 'pagamentos' && <TodosPagamentos mesInicial={mesAberto} aoVoltar={voltar} aoMudar={recarregarCaixa} />}
        {vista === 'cobrancas' && (
          <CobrancasAbertas cobrancas={emAberto} aoVoltar={voltar} aoReceber={abrirPagamento} />
        )}
        {vista === 'planos' && <GestaoPlanos dono={dono} aoVoltar={voltar} alunosNoPlano={alunosNoPlano}
                                             aoMudar={() => { recAtivos(); recRel(); }} avisarErro={(m) => avisar(m, 'erro')} />}
        {janelas}
      </div>
    );
  }

  // as 4 piores primeiro: quem está vencido há mais tempo
  const piores = [...emAberto].sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 4);
  const meses = dono ? ultimos?.meses ?? [] : [];

  return (
    <div className="container entrar" key="resumo">
      <div className="sec-head">
        <h2>Financeiro<Olho /></h2>
        {dono && rel && (
          <button className="btn btn-secondary btn-sm" onClick={() => setVerRelatorio(true)}>
            Relatório de {rel.mesPorExtenso.split(' de ')[0]}
          </button>
        )}
      </div>

      {dono && resumo && (
        <div className="fin__cartoes escalonar">
          <Cartao rotulo="Recebido no mês" valor={<Contagem valor={resumo.receitaMesCentavos!} formatar={dinheiro} />}
                  sub={variacao?.texto} tomSub={variacao?.tom} />
          <Cartao rotulo="A receber" valor={<Contagem valor={resumo.inadimplenciaCentavos!} formatar={dinheiro} />} tom="danger"
                  sub={`${resumo.vencidos} ${resumo.vencidos === 1 ? 'aluno vencido' : 'alunos vencidos'}`} />
          <Cartao rotulo="Recebido hoje" valor={<Contagem valor={resumo.recebidoHojeCentavos!} formatar={dinheiro} />} tom="ok" />
          <Cartao rotulo="Ticket médio" valor={<Contagem valor={rel?.ticketMedioCentavos ?? 0} formatar={dinheiro} />}
                  sub={rel ? `${rel.pagamentos} ${rel.pagamentos === 1 ? 'pagamento' : 'pagamentos'} no mês` : undefined} />
        </div>
      )}

      <div className="resumo-grade escalonar">
        {dono && meses.length > 0 && (
          <Secao className="secao--larga" titulo="Receita por mês"
                 resumo="Últimos 12 meses. Toque numa barra para ver os pagamentos daquele mês."
                 verTudo={{ rotulo: 'Ver pagamentos', aoClicar: () => { setMesAberto(undefined); setVista('pagamentos'); } }}>
            <BarrasVerticais
              altura={110} formatar={dinheiro}
              dados={meses.map((m) => ({
                rotulo: mesCurto(m.mes, m.mes.endsWith('-01')), valor: m.totalCentavos, destaque: m.mes === H.slice(0, 7),
                detalhe: `${m.quantidade} ${m.quantidade === 1 ? 'pagamento' : 'pagamentos'}`,
              }))}
              aoEscolher={(i) => { setMesAberto(meses[i].mes); setVista('pagamentos'); }}
            />
          </Secao>
        )}

        <Secao titulo="Cobranças em aberto"
               resumo={emAberto.length
                 ? `${emAberto.length} ${emAberto.length === 1 ? 'pessoa' : 'pessoas'}, ${dinheiro(totalAberto)}`
                 : 'Ninguém em aberto'}
               alerta={atrasadas.length ? `${atrasadas.length} vencida${atrasadas.length === 1 ? '' : 's'}` : undefined}
               verTudo={emAberto.length ? { rotulo: `Ver todas (${emAberto.length})`, aoClicar: () => setVista('cobrancas') } : undefined}>
          {piores.length > 0 && piores.map((c) => {
            const v = quandoVence(c, H);
            return (
              <button key={c.id} type="button" className="previa-linha" onClick={() => abrirPagamento(c.alunoId)}
                      title={`Receber de ${c.alunoNome}`}>
                <div className="previa-linha__info">
                  <div className="previa-linha__nome">{c.alunoNome}</div>
                  <div className={`previa-linha__det ${v.atrasada ? 't-danger' : 't-warn'}`}>{v.texto}</div>
                </div>
                <span className={`previa-linha__valor ${v.atrasada ? 'valor-danger' : ''}`}>{dinheiro(c.valorCentavos)}</span>
              </button>
            );
          })}
        </Secao>

        <Secao titulo="Últimos pagamentos"
               resumo={ultimos ? (ultimos.quantidade ? 'Os mais recentes, de qualquer mês.' : 'Nenhum pagamento ainda.') : undefined}
               verTudo={{ rotulo: 'Ver todos', aoClicar: () => { setMesAberto('tudo'); setVista('pagamentos'); } }}>
          {ultimos?.itens.map((p) => (
            <div key={p.id} className="previa-linha">
              <div className="previa-linha__info">
                <div className="previa-linha__nome">{p.alunoNome}</div>
                <div className="previa-linha__det">{formatarData(p.dataPagamento)}, {ROTULO_FORMA[p.forma] ?? p.forma}</div>
              </div>
              <span className="previa-linha__valor valor-ok">{dinheiro(p.valorCentavos)}</span>
            </div>
          ))}
        </Secao>

        <Secao titulo="Planos"
               resumo={planosAtivos ? `${planosAtivos.length} ${planosAtivos.length === 1 ? 'plano à venda' : 'planos à venda'}` : undefined}
               verTudo={{ rotulo: dono ? 'Gerenciar planos' : 'Ver planos', aoClicar: () => setVista('planos') }}>
          {planosAtivos?.map((p) => (
            <div key={p.id} className="previa-linha">
              <div className="previa-linha__info">
                <div className="previa-linha__nome">{p.nome}</div>
                {dono && rel && <div className="previa-linha__det">{alunosNoPlano(p.nome)} {alunosNoPlano(p.nome) === 1 ? 'aluno' : 'alunos'}</div>}
              </div>
              <span className="previa-linha__valor">{dinheiro(p.precoCentavos)}<small className="plano-sufixo">{sufixoDuracao(p)}</small></span>
            </div>
          ))}
        </Secao>
      </div>

      {janelas}
    </div>
  );
}

/* ─── painel: cobranças em aberto ─────────────────────────── */

function CobrancasAbertas({ cobrancas, aoVoltar, aoReceber }: {
  cobrancas: Cobranca[]; aoVoltar: () => void; aoReceber: (alunoId: number) => void;
}) {
  const { formatar: dinheiro } = useValores();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'vencidas' | 'avencer'>('todas');
  const H = hoje();
  const lista = cobrancas
    .filter((c) => contem(c.alunoNome, busca))
    .filter((c) => filtro === 'todas' || (filtro === 'vencidas') === (diffDias(H, c.vencimento) < 0))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const vencidas = cobrancas.filter((c) => diffDias(H, c.vencimento) < 0).length;

  return (
    <SubTela origem="Financeiro" aoVoltar={aoVoltar} titulo={<>Cobranças em aberto<Olho /></>}
             sub={`${cobrancas.length} ${cobrancas.length === 1 ? 'pessoa' : 'pessoas'}, ${dinheiro(cobrancas.reduce((s, c) => s + c.valorCentavos, 0))}. A mais atrasada primeiro.`}>
      <div className="pg-filtros">
        <div className="segmento" role="tablist" aria-label="Quais cobranças">
          {([['todas', `Todas (${cobrancas.length})`], ['vencidas', `Vencidas (${vencidas})`], ['avencer', `A vencer (${cobrancas.length - vencidas})`]] as const)
            .map(([id, rotulo]) => (
              <button key={id} role="tab" aria-selected={filtro === id} className={filtro === id ? 'on' : ''}
                      onClick={() => setFiltro(id)}>{rotulo}</button>
            ))}
        </div>
        <div className="busca pg-filtros__busca">
          <input type="search" placeholder="Buscar aluno" value={busca} aria-label="Buscar nas cobranças em aberto"
                 onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      <div className="card cobrancas-card">
        {!lista.length && <div className="vazio"><strong>Ninguém aqui</strong>{busca ? 'Nenhum nome bate com a busca.' : 'Nenhuma cobrança neste filtro.'}</div>}
        {lista.map((c) => {
          const v = quandoVence(c, H);
          return (
            <div key={c.id} className="cobranca">
              <div className="cobranca__info">
                <div className="cobranca__nome">{c.alunoNome}</div>
                <div className={`cobranca__venc ${v.atrasada ? 'grave' : ''}`}>{v.texto}, {formatarData(c.vencimento)}</div>
              </div>
              <strong className={v.atrasada ? 'valor-danger' : ''}>{dinheiro(c.valorCentavos)}</strong>
              <button className="btn btn-sm btn-secondary" onClick={() => aoReceber(c.alunoId)}>Receber</button>
            </div>
          );
        })}
      </div>

      <div className="pix-nota">
        <IconeAlerta size={15} />
        <div>
          <strong>A confirmação do Pix é manual</strong>
          A chave estática gera o QR, mas não avisa quando o dinheiro cai. Confirme conferindo o
          <b> extrato do banco</b>, nunca pelo print do aluno.
        </div>
      </div>
    </SubTela>
  );
}

/* ─── painel: planos ──────────────────────────────────────── */

function GestaoPlanos({ dono, aoVoltar, alunosNoPlano, aoMudar, avisarErro }: {
  dono: boolean; aoVoltar: () => void; alunosNoPlano: (nome: string) => number;
  aoMudar: () => void; avisarErro: (msg: string) => void;
}) {
  const { formatar: dinheiro } = useValores();
  const [verDesativados, setVerDesativados] = useState(false);
  const { dados: planos, recarregar } = useDados(() => api.planos(dono && verDesativados), [dono, verDesativados]);
  const [editando, setEditando] = useState<Plano | null>(null);
  const [criando, setCriando] = useState(false);
  /** ordem mostrada enquanto o servidor grava: a seta responde na hora */
  const [ordemLocal, setOrdemLocal] = useState<Plano[] | null>(null);
  const lista = ordemLocal ?? planos ?? [];

  async function trocarOrdem(indice: number, direcao: -1 | 1) {
    const nova = mover(lista, indice, indice + direcao);
    setOrdemLocal(nova);
    try {
      await api.ordenarPlanos(nova.map((p) => p.id));
      await recarregar();
      aoMudar();
    } catch (err: any) {
      avisarErro(err.message);
    } finally {
      setOrdemLocal(null);
    }
  }

  return (
    <SubTela origem="Financeiro" aoVoltar={aoVoltar} titulo="Planos"
             sub="Preço, duração e o que cada plano oferece. A ordem aqui é a ordem na hora de receber."
             acoes={dono && (
               <>
                 <button className="btn btn-secondary btn-sm" aria-pressed={verDesativados}
                         onClick={() => setVerDesativados((v) => !v)}>
                   {verDesativados ? 'Esconder desativados' : 'Ver desativados'}
                 </button>
                 <button className="btn btn-primary btn-sm" onClick={() => setCriando(true)}>Novo plano</button>
               </>
             )}>
      <div className="planos escalonar">
        {lista.map((p, i) => (
          <div key={p.id} className={`plano ${p.destaque ? 'destaque' : ''} ${p.ativo ? '' : 'plano--inativo'}`}>
            {!p.ativo
              ? <span className="plano__tag plano__tag--off">Desativado</span>
              : p.destaque && <span className="plano__tag">Popular</span>}
            <div className="plano__nome">{p.nome}</div>
            <div className="plano__preco">
              <span>{dinheiro(p.precoCentavos)}</span><small>{sufixoDuracao(p)}</small>
            </div>
            {dono && <div className="plano__alunos">{alunosNoPlano(p.nome)} {alunosNoPlano(p.nome) === 1 ? 'aluno neste plano' : 'alunos neste plano'}</div>}
            {p.beneficios.map((b) => <div key={b} className="plano__item">{b}</div>)}
            {dono && (
              <div className="plano__rodape">
                <button className="btn btn-secondary btn-sm" onClick={() => setEditando(p)}>Editar</button>
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

      {(editando || criando) && (
        <FormPlano plano={editando} aoFechar={() => { setEditando(null); setCriando(false); }}
                   aoSalvar={() => { setEditando(null); setCriando(false); recarregar(); aoMudar(); }} />
      )}
    </SubTela>
  );
}

function Cartao({ rotulo, valor, sub, tom, tomSub }: {
  rotulo: string; valor: React.ReactNode; sub?: string; tom?: string; tomSub?: string;
}) {
  return (
    <div className="fin-cartao">
      <div className="fin-cartao__rot">{rotulo}</div>
      <div className={`fin-cartao__val ${tom ? `t-${tom}` : ''}`}>{valor}</div>
      {sub && <div className={`fin-cartao__sub ${tomSub ? `t-${tomSub}` : ''}`}>{sub}</div>}
    </div>
  );
}
