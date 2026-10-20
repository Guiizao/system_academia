import { useEffect, useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao } from '../sessao';
import { formatarData, formatarHora, hoje, rotuloPeriodos, somarMes, ROTULO_FORMA } from '../dominio';
import { SubTela } from '../componentes/Secao';
import { AcoesPagamento, ExcluirPagamento, FormEditarPagamento, descreverCobertura } from '../componentes/Pagamentos';
import { Olho, useValores } from '../componentes/Valores';
import type { AlteracaoPagamento, FormaPagamento, FotoPagamento, PagamentoDetalhe, Plano } from '../tipos';

/**
 * Todos os pagamentos, numa tabela: por mês ou de todos os tempos, com busca
 * sem acento, forma e plano. Os totais valem para o filtro inteiro, não só
 * para a página. Editar e excluir ficam em cada linha (só o dono), e a aba
 * Alterações mostra quem mudou o quê -- agora que dinheiro pode ser editado,
 * é o que protege quem trabalha no caixa.
 */

const POR_PAGINA = 50;

export function mesPorExtenso(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  const t = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function TodosPagamentos({ mesInicial, aoVoltar, aoMudar }: {
  /** 'AAAA-MM' (veio de uma barra do gráfico: abre naquele mês) ou 'tudo' (de qualquer mês) */
  mesInicial?: string;
  aoVoltar: () => void;
  /** editou ou excluiu: quem mostra os totais do caixa recarrega junto */
  aoMudar: () => void;
}) {
  const { usuario } = useSessao();
  const dono = usuario.papel === 'dono';
  const { formatar: dinheiro } = useValores();
  const mesAtual = hoje().slice(0, 7);

  const [aba, setAba] = useState<'lista' | 'alteracoes'>('lista');
  const [modo, setModo] = useState<'mes' | 'tudo'>(mesInicial === 'tudo' ? 'tudo' : 'mes');
  const [mes, setMes] = useState(mesInicial && mesInicial !== 'tudo' ? mesInicial : mesAtual);
  const [digitado, setDigitado] = useState('');
  const [busca, setBusca] = useState('');
  const [forma, setForma] = useState<FormaPagamento | ''>('');
  const [planoId, setPlanoId] = useState('');
  const [pagina, setPagina] = useState(1);
  const [editando, setEditando] = useState<PagamentoDetalhe | null>(null);
  const [excluindo, setExcluindo] = useState<PagamentoDetalhe | null>(null);
  const [alteracoesDe, setAlteracoesDe] = useState<PagamentoDetalhe | null>(null);

  // espera a pessoa parar de digitar: sem isso cada letra viraria uma consulta.
  // Nome digitado procura em TODOS os meses: é o "fulano pagou quando?"
  useEffect(() => {
    const t = setTimeout(() => {
      const b = digitado.trim();
      setBusca(b); setPagina(1);
      if (b) setModo('tudo');
    }, 300);
    return () => clearTimeout(t);
  }, [digitado]);
  // filtro novo começa da primeira página, no mesmo clique (sem um pedido a mais com a página velha)
  const filtrar = (mudar: () => void) => { mudar(); setPagina(1); };

  const { dados: planos } = useDados(() => api.planos(true), []);
  const { dados, carregando, erro, recarregar } = useDados(() => api.historicoPagamentos({
    ...(modo === 'mes' ? { mes } : {}),
    busca, forma: forma || undefined, planoId: planoId ? Number(planoId) : undefined,
    pagina, porPagina: POR_PAGINA,
  }), [modo, mes, busca, forma, planoId, pagina]);

  // excluiu o último da última página: volta para a última que ainda existe
  useEffect(() => {
    if (dados && dados.totalPaginas > 0 && pagina > dados.totalPaginas) setPagina(dados.totalPaginas);
  }, [dados, pagina]);

  const mudou = () => { recarregar(); aoMudar(); };
  const filtrando = !!(busca || forma || planoId);

  return (
    <SubTela
      origem="Financeiro" aoVoltar={aoVoltar}
      titulo={<>Pagamentos<Olho /></>}
      sub="Todos os pagamentos registrados, com quem recebeu e o que cada um cobriu."
      acoes={dono && (
        <div className="segmento" role="tablist" aria-label="O que mostrar">
          <button role="tab" aria-selected={aba === 'lista'} className={aba === 'lista' ? 'on' : ''}
                  onClick={() => { setAba('lista'); setAlteracoesDe(null); }}>Lista</button>
          <button role="tab" aria-selected={aba === 'alteracoes'} className={aba === 'alteracoes' ? 'on' : ''}
                  onClick={() => setAba('alteracoes')}>Alterações</button>
        </div>
      )}
    >
      {aba === 'alteracoes' ? (
        <Alteracoes de={alteracoesDe} planos={planos} aoVerTodas={() => setAlteracoesDe(null)} />
      ) : (
        <>
          <div className="pg-filtros">
            <div className="pg-filtros__periodo">
              <div className="segmento" role="tablist" aria-label="Período">
                <button role="tab" aria-selected={modo === 'mes'} className={modo === 'mes' ? 'on' : ''}
                        onClick={() => filtrar(() => setModo('mes'))}>Por mês</button>
                <button role="tab" aria-selected={modo === 'tudo'} className={modo === 'tudo' ? 'on' : ''}
                        onClick={() => filtrar(() => setModo('tudo'))}>Todos</button>
              </div>
              {modo === 'mes' && (
                <div className="pg-mes">
                  <button type="button" className="icone-btn" onClick={() => filtrar(() => setMes((m) => somarMes(m, -1)))}
                          aria-label="Mês anterior">‹</button>
                  <strong>{mesPorExtenso(mes)}</strong>
                  <button type="button" className="icone-btn" onClick={() => filtrar(() => setMes((m) => somarMes(m, 1)))}
                          disabled={mes >= mesAtual} aria-label="Próximo mês">›</button>
                </div>
              )}
            </div>
            <div className="pg-filtros__campos">
              <div className="busca pg-filtros__busca">
                <input type="search" placeholder="Buscar aluno" value={digitado}
                       onChange={(e) => setDigitado(e.target.value)} aria-label="Buscar pagamentos pelo nome do aluno" />
              </div>
              <select className="pg-select" value={forma} onChange={(e) => filtrar(() => setForma(e.target.value as FormaPagamento | ''))}
                      aria-label="Forma de pagamento">
                <option value="">Todas as formas</option>
                {Object.entries(ROTULO_FORMA).map(([f, r]) => <option key={f} value={f}>{r}</option>)}
              </select>
              <select className="pg-select" value={planoId} onChange={(e) => filtrar(() => setPlanoId(e.target.value))} aria-label="Plano">
                <option value="">Todos os planos</option>
                {planos?.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.ativo ? '' : ' (desativado)'}</option>)}
              </select>
            </div>
          </div>

          {dados && (
            <div className="pg-totais">
              {/* para a recepção o servidor não manda o total do caixa: fica só a contagem */}
              <span>
                {dados.totalCentavos != null && <><b>{dinheiro(dados.totalCentavos)}</b> em </>}
                {dados.quantidade} {dados.quantidade === 1 ? 'pagamento' : 'pagamentos'}
              </span>
              {dados.porForma?.map((f) => (
                <span key={f.forma} className="pg-totais__forma">{ROTULO_FORMA[f.forma] ?? f.forma} {dinheiro(f.totalCentavos)}</span>
              ))}
            </div>
          )}

          <div className={`pg-tabela ${dono ? '' : 'pg-tabela--sem-acoes'}`} role="table" aria-label="Pagamentos">
            <div className="pg-tabela__cab" role="row">
              <span role="columnheader">Data</span>
              <span role="columnheader">Aluno</span>
              <span role="columnheader">Plano</span>
              <span role="columnheader">Forma</span>
              <span role="columnheader" className="pg-tabela__num">Valor</span>
              {dono && <span role="columnheader" aria-label="Ações" />}
            </div>

            {erro ? <div className="erro-carga">{erro}</div>
              : carregando && !dados ? <div className="carregando">Carregando…</div>
              : !dados?.itens.length ? (
                <div className="vazio">
                  <strong>Nenhum pagamento {filtrando ? 'com esse filtro' : modo === 'mes' ? 'neste mês' : 'registrado'}</strong>
                  {filtrando ? (modo === 'mes' ? 'Mude o mês, a busca, a forma ou o plano.' : 'Mude a busca, a forma ou o plano.') : modo === 'mes' ? 'Troque o mês nas setas ou veja Todos.' : 'Os pagamentos aparecem aqui assim que forem recebidos.'}
                </div>
              ) : dados.itens.map((p) => (
                <div key={p.id} className="pg-tabela__linha" role="row">
                  <span role="cell" className="pg-tabela__data">{formatarData(p.dataPagamento)}</span>
                  <span role="cell" className="pg-tabela__aluno">
                    <div>
                      <b>{p.alunoNome}</b>
                      {/* no celular as colunas somem e o detalhe vem aqui embaixo do nome */}
                      <span className="pg-tabela__det">
                        {formatarData(p.dataPagamento)}, {ROTULO_FORMA[p.forma] ?? p.forma}, {descreverCobertura(p, planos) ?? 'Avulso'}{p.editado ? ', editado' : ''}
                      </span>
                    </div>
                    {p.editado && dono && (
                      <button type="button" className="badge b-mudo pg-tabela__editado"
                              onClick={() => { setAlteracoesDe(p); setAba('alteracoes'); }}
                              title="Ver o que mudou neste pagamento">editado</button>
                    )}
                  </span>
                  <span role="cell" className="pg-tabela__plano">{descreverCobertura(p, planos) ?? 'Avulso'}</span>
                  <span role="cell" className="pg-tabela__forma">
                    {ROTULO_FORMA[p.forma] ?? p.forma}
                    {p.registradoPorNome && <small>por {p.registradoPorNome}</small>}
                  </span>
                  <strong role="cell" className="pg-tabela__num valor-ok">{dinheiro(p.valorCentavos)}</strong>
                  {dono && (
                    <span role="cell" className="pg-tabela__acoes">
                      <AcoesPagamento nome={p.alunoNome} aoEditar={() => setEditando(p)} aoExcluir={() => setExcluindo(p)} />
                    </span>
                  )}
                </div>
              ))}
          </div>

          {dados && dados.totalPaginas > 1 && (
            <div className="pg-paginas">
              <button type="button" className="btn btn-secondary btn-sm" disabled={pagina <= 1}
                      onClick={() => setPagina((n) => n - 1)}>‹ Anterior</button>
              <span>Página {dados.pagina} de {dados.totalPaginas}</span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={pagina >= dados.totalPaginas}
                      onClick={() => setPagina((n) => n + 1)}>Próxima ›</button>
            </div>
          )}
        </>
      )}

      {editando && <FormEditarPagamento pagamento={editando} aoFechar={() => setEditando(null)}
                                        aoSalvar={() => { setEditando(null); mudou(); }} />}
      {excluindo && <ExcluirPagamento pagamento={excluindo} aoFechar={() => setExcluindo(null)}
                                      aoExcluir={() => { setExcluindo(null); mudou(); }} />}
    </SubTela>
  );
}

/* ─── registro de alterações ─────────────────────────────── */

const CAMPOS: Array<[keyof FotoPagamento, string]> = [
  ['dataPagamento', 'Data'], ['valorCentavos', 'Valor'], ['forma', 'Forma'],
  ['planoNome', 'Plano'], ['periodos', 'Tempo pago'], ['observacao', 'Observação'],
];

function Alteracoes({ de, planos, aoVerTodas }: { de: PagamentoDetalhe | null; planos?: Plano[] | null; aoVerTodas: () => void }) {
  const { formatar: dinheiro } = useValores();
  const { dados, carregando, erro } = useDados(
    () => api.alteracoesPagamentos(de ? { pagamentoId: de.id } : { limite: 100 }), [de?.id]);

  const mostrar = (campo: keyof FotoPagamento, v: unknown, foto?: FotoPagamento): string => {
    if (v == null || v === '') return '—';
    if (campo === 'dataPagamento') return formatarData(String(v));
    if (campo === 'valorCentavos') return dinheiro(Number(v));
    if (campo === 'forma') return ROTULO_FORMA[String(v)] ?? String(v);
    if (campo === 'periodos') {
      // mesmo rótulo da janela de editar ("2 meses"), quando dá para saber o plano
      const plano = planos?.find((x) => x.nome === foto?.planoNome);
      if (plano && !plano.duracaoDias) return rotuloPeriodos(Number(v), plano.duracaoMeses);
      return Number(v) === 1 ? '1 período' : `${v} períodos`;
    }
    return String(v);
  };

  return (
    <div className="alteracoes">
      {de && (
        <div className="alteracoes__filtro">
          Só o pagamento de <b>{de.alunoNome}</b> de {formatarData(de.dataPagamento)}.
          <button type="button" className="link-btn" onClick={aoVerTodas}>Ver todas as alterações</button>
        </div>
      )}
      {erro ? <div className="erro-carga">{erro}</div>
        : carregando && !dados ? <div className="carregando">Carregando…</div>
        : !dados?.length ? (
          <div className="vazio"><strong>Nenhuma alteração</strong>Quando alguém editar ou excluir um pagamento, fica registrado aqui.</div>
        ) : dados.map((a: AlteracaoPagamento) => {
          const mudancas = a.depois
            ? CAMPOS.filter(([c]) => a.antes[c] !== a.depois![c])
            : [];
          return (
            <div key={a.id} className={`alteracao alteracao--${a.acao}`}>
              <div className="alteracao__cab">
                <span className={`ponto ${a.acao === 'excluiu' ? 'danger' : 'warn'}`} />
                <span><b>{a.usuarioNome ?? 'Alguém'}</b> {a.acao === 'excluiu' ? 'excluiu' : 'editou'} o pagamento de <b>{a.alunoNome}</b></span>
                <small>{new Date(a.em).toLocaleDateString('pt-BR')}, {formatarHora(a.em)}</small>
              </div>
              {a.acao === 'excluiu' ? (
                <div className="alteracao__det">
                  Era {mostrar('valorCentavos', a.antes.valorCentavos)} em {mostrar('forma', a.antes.forma)},
                  de {mostrar('dataPagamento', a.antes.dataPagamento)}{a.antes.planoNome ? `, ${a.antes.planoNome}` : ''}.
                </div>
              ) : (
                <ul className="alteracao__det">
                  {mudancas.map(([c, rotulo]) => (
                    <li key={c}>{rotulo}: <s>{mostrar(c, a.antes[c], a.antes)}</s> <span aria-hidden="true">›</span> <b>{mostrar(c, a.depois![c], a.depois!)}</b></li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
    </div>
  );
}
