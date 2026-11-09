import { useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao } from '../sessao';
import { formatarData, rotuloPeriodos, ROTULO_FORMA } from '../dominio';
import { Modal } from './Modal';
import { ConfirmarSenha } from './ConfirmarSenha';
import { IconeLapis, IconeLixeira } from './Icones';
import { useValores } from './Valores';
import type { FormaPagamento, PagamentoDetalhe, Plano, Venda } from '../tipos';
import './Pagamentos.css';

/**
 * Pagamentos com editar e excluir: a MESMA janela na ficha do aluno e na
 * tabela do Financeiro. Editar e excluir são do dono, com a senha dele; o
 * servidor confere e recalcula o vencimento quando a data, o plano ou o tempo
 * pago mudam.
 */

const FORMAS = Object.entries(ROTULO_FORMA) as Array<[FormaPagamento, string]>;

/** "Plus, 2 meses" -- o que este pagamento cobriu, numa frase curta. */
export function descreverCobertura(p: PagamentoDetalhe, planos?: Plano[] | null): string | null {
  if (!p.planoNome) return p.observacao;
  const plano = planos?.find((x) => x.id === p.planoId);
  if (!p.periodos || !plano || plano.duracaoDias) return p.planoNome;
  return p.periodos > 1 || plano.duracaoMeses > 1
    ? `${p.planoNome}, ${rotuloPeriodos(p.periodos, plano.duracaoMeses)}`
    : p.planoNome;
}

/** Venda não aceita boleto: só as quatro formas do balcão. */
export const FORMAS_VENDA: Array<[FormaPagamento, string]> = [['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['debito', 'Débito'], ['credito', 'Crédito']];

export function ReceberVenda({ venda: v, aoEscolher }: { venda: Venda; aoEscolher: (forma: FormaPagamento) => void }) {
  return (
    <select className="loja__receber" aria-label={`Receber ${v.produtoNome} de ${v.alunoNome ?? v.clienteNome}`} value=""
            onChange={(e) => e.target.value && aoEscolher(e.target.value as FormaPagamento)}>
      <option value="">Receber…</option>
      {FORMAS_VENDA.map(([f, r]) => <option key={f} value={f}>em {r}</option>)}
    </select>
  );
}

export const nomeDaVenda = (v: Venda) => (v.quantidade > 1 ? `${v.produtoNome} × ${v.quantidade}` : v.produtoNome);

/** O que o aluno levou da loja, na ficha dele: primeiro o que está devendo. */
export function ProdutosDoAluno({ vendas, aoMudar }: { vendas: Venda[]; aoMudar: () => void }) {
  const { avisar } = useSessao();
  const { formatar: dinheiro } = useValores();
  if (!vendas.length) return null;
  const fiado = vendas.filter((v) => v.situacao === 'fiado');

  async function receber(v: Venda, forma: FormaPagamento) {
    try {
      await api.receberVenda(v.id, forma);
      avisar(`${nomeDaVenda(v)}: ${dinheiro(v.totalCentavos)} recebido`, 'ok');
      aoMudar();
    } catch (e: any) { avisar(e.message, 'erro'); }
  }

  return (
    <section className="produtos-aluno">
      <div className="lista-cab">
        <span>{vendas.length} {vendas.length === 1 ? 'produto' : 'produtos'}
          {fiado.length > 0 && <>, devendo <strong className="t-danger">{dinheiro(fiado.reduce((s, v) => s + v.totalCentavos, 0))}</strong></>}
        </span>
      </div>
      <div className="pagamentos">
        {[...fiado, ...vendas.filter((v) => v.situacao === 'paga')].map((v) => (
          <div key={v.id} className="pagamentos__linha">
            <div className="pagamentos__info">
              <div className="pagamentos__titulo">
                <span>{nomeDaVenda(v)}</span>
                {v.situacao === 'fiado' && <span className="badge b-danger pagamentos__editado">devendo</span>}
              </div>
              <div className="pagamentos__detalhe">
                {v.situacao === 'fiado'
                  ? `Levou em ${formatarData(v.dataVenda)}`
                  : `Pago em ${formatarData(v.pagaEm ?? v.dataVenda)}${v.forma ? `, ${ROTULO_FORMA[v.forma] ?? v.forma}` : ''}${v.pagamentoId ? ', junto com a mensalidade' : ''}`}
              </div>
            </div>
            <strong className={`pagamentos__valor ${v.situacao === 'fiado' ? 'valor-danger' : 'valor-ok'}`}>{dinheiro(v.totalCentavos)}</strong>
            {v.situacao === 'fiado' ? <ReceberVenda venda={v} aoEscolher={(f) => receber(v, f)} /> : <span />}
          </div>
        ))}
      </div>
    </section>
  );
}

export function ListaPagamentos({ itens, mostrarAluno, aoMudar }: {
  itens: PagamentoDetalhe[];
  /** na tabela geral aparece o nome; na ficha do aluno, não precisa */
  mostrarAluno: boolean;
  aoMudar: () => void;
}) {
  const { usuario } = useSessao();
  const dono = usuario.papel === 'dono';
  const { formatar: dinheiro } = useValores();
  const { dados: planos } = useDados(() => api.planos(true), []);
  const [editando, setEditando] = useState<PagamentoDetalhe | null>(null);
  const [excluindo, setExcluindo] = useState<PagamentoDetalhe | null>(null);

  return (
    <>
      <div className="pagamentos">
        {itens.map((p) => {
          const cobertura = descreverCobertura(p, planos);
          return (
            <div key={p.id} className="pagamentos__linha">
              <div className="pagamentos__info">
                <div className="pagamentos__titulo">
                  <span>{mostrarAluno ? p.alunoNome : (cobertura ?? 'Pagamento')}</span>
                  {p.editado && <span className="badge b-mudo pagamentos__editado">editado</span>}
                </div>
                <div className="pagamentos__detalhe">
                  {formatarData(p.dataPagamento)}, {ROTULO_FORMA[p.forma] ?? p.forma}
                  {mostrarAluno && cobertura ? `, ${cobertura}` : ''}
                </div>
              </div>
              <strong className="pagamentos__valor valor-ok">{dinheiro(p.valorCentavos)}</strong>
              {dono && <AcoesPagamento aoEditar={() => setEditando(p)} aoExcluir={() => setExcluindo(p)} nome={p.alunoNome} />}
            </div>
          );
        })}
      </div>

      {editando && <FormEditarPagamento pagamento={editando} aoFechar={() => setEditando(null)}
                                        aoSalvar={() => { setEditando(null); aoMudar(); }} />}
      {excluindo && <ExcluirPagamento pagamento={excluindo} aoFechar={() => setExcluindo(null)}
                                      aoExcluir={() => { setExcluindo(null); aoMudar(); }} />}
    </>
  );
}

/** Lápis e lixeira: os dois botões de cada pagamento, iguais em toda tela. */
export function AcoesPagamento({ nome, aoEditar, aoExcluir }: { nome: string; aoEditar: () => void; aoExcluir: () => void }) {
  return (
    <div className="pagamentos__acoes">
      <button type="button" className="icone-btn" onClick={aoEditar}
              title="Editar este pagamento" aria-label={`Editar pagamento de ${nome}`}>
        <IconeLapis size={16} />
      </button>
      <button type="button" className="icone-btn icone-btn--perigo" onClick={aoExcluir}
              title="Excluir este pagamento" aria-label={`Excluir pagamento de ${nome}`}>
        <IconeLixeira size={16} />
      </button>
    </div>
  );
}

export function ExcluirPagamento({ pagamento: p, aoFechar, aoExcluir }: {
  pagamento: PagamentoDetalhe; aoFechar: () => void; aoExcluir: () => void;
}) {
  const { avisar } = useSessao();
  const { formatar: dinheiro } = useValores();
  return (
    <ConfirmarSenha
      titulo="Excluir pagamento"
      rotuloBotao={`Excluir ${dinheiro(p.valorCentavos)} de ${p.alunoNome}`}
      explicacao={p.alteraVencimento
        ? <>O pagamento sai do caixa e o vencimento de <b>{p.alunoNome}</b> volta a ser o de antes dele. Fica no registro de alterações quem excluiu.</>
        : <>O pagamento sai do caixa. Fica no registro de alterações quem excluiu.</>}
      aoFechar={aoFechar}
      aoConfirmar={async (senha) => {
        const r = await api.excluirPagamento(p.id, senha);
        avisar(r.dataFimNova
          ? `Pagamento excluído. ${p.alunoNome} volta a vencer em ${formatarData(r.dataFimNova)}.`
          : 'Pagamento excluído.', 'ok', { semFesta: true });
        aoExcluir();
      }}
    />
  );
}

export function FormEditarPagamento({ pagamento: p, aoFechar, aoSalvar }: {
  pagamento: PagamentoDetalhe; aoFechar: () => void; aoSalvar: () => void;
}) {
  const { avisar } = useSessao();
  const { dados: planos } = useDados(() => api.planos(), []);
  // Data, plano e tempo pago só mudam quando este pagamento é o que gerou o
  // vencimento de hoje (ou quando é avulso, que não mexe em vencimento nenhum).
  // Com renovação depois dele, mudar a data embaralharia os períodos seguintes.
  const comRenovacaoDepois = !!p.matriculaId && !p.alteraVencimento;
  const podeTrocarPlano = p.alteraVencimento;

  const [data, setData] = useState(p.dataPagamento);
  const [valor, setValor] = useState((p.valorCentavos / 100).toFixed(2).replace('.', ','));
  const [forma, setForma] = useState<FormaPagamento>(p.forma);
  const [planoId, setPlanoId] = useState(p.planoId ? String(p.planoId) : '');
  // abre marcando o que foi pago: "a pessoa pagou 2 meses e eu marquei 1"
  const [periodos, setPeriodos] = useState(String(p.periodos ?? 1));
  const [observacao, setObservacao] = useState(p.observacao ?? '');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const plano = planos?.find((x) => String(x.id) === planoId);
  const mensal = !!plano && !plano.duracaoDias;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const centavos = Math.round(Number(valor.replace(/\./g, '').replace(',', '.')) * 100);
    if (!Number.isFinite(centavos) || centavos <= 0) { setErro('Valor inválido. Exemplo: 89,90'); return; }
    // manda só o que mudou: o servidor decide o que recalcular
    const mudancas = {
      ...(data !== p.dataPagamento ? { dataPagamento: data } : {}),
      ...(centavos !== p.valorCentavos ? { valorCentavos: centavos } : {}),
      ...(forma !== p.forma ? { forma } : {}),
      ...(podeTrocarPlano && planoId && Number(planoId) !== p.planoId ? { planoId: Number(planoId) } : {}),
      ...(podeTrocarPlano && mensal && Number(periodos) !== (p.periodos ?? 1) ? { periodos: Number(periodos) } : {}),
      ...(observacao !== (p.observacao ?? '') ? { observacao } : {}),
    };
    if (!Object.keys(mudancas).length) { setErro('Nada foi alterado.'); return; }
    setErro(null); setEnviando(true);
    try {
      const r = await api.editarPagamento(p.id, { senha, ...mudancas });
      avisar(r.dataFimNova ? `Pagamento alterado. Vencimento agora: ${formatarData(r.dataFimNova)}.` : 'Pagamento alterado.', 'ok');
      aoSalvar();
    } catch (err: any) { setErro(err.message); setSenha(''); }
    finally { setEnviando(false); }
  }

  return (
    <Modal titulo="Editar pagamento" aoFechar={aoFechar}>
      <form onSubmit={salvar}>
        <p className="form-nota form-nota--quem">
          {p.alunoNome}{p.planoNome ? `, ${p.planoNome}` : ''}
          {p.registradoPorNome && <small> Registrado por {p.registradoPorNome}.</small>}
        </p>

        <div className="linha2">
          <div className="campo"><label htmlFor="ep-data">Data do pagamento</label>
            <input id="ep-data" type="date" required value={data} disabled={comRenovacaoDepois}
                   max={new Date().toLocaleDateString('sv-SE')}
                   onChange={(e) => setData(e.target.value)} /></div>
          <div className="campo"><label htmlFor="ep-valor">Valor (R$)</label>
            <input id="ep-valor" required inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
        </div>

        <div className="linha2">
          <div className="campo"><label htmlFor="ep-forma">Forma</label>
            <select id="ep-forma" value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
              {FORMAS.map(([f, r]) => <option key={f} value={f}>{r}</option>)}
            </select></div>
          {podeTrocarPlano && (
            <div className="campo"><label htmlFor="ep-plano">Plano</label>
              <select id="ep-plano" value={planoId} onChange={(e) => setPlanoId(e.target.value)}>
                {!plano && p.planoNome && <option value={planoId}>{p.planoNome} (desativado)</option>}
                {planos?.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select></div>
          )}
        </div>

        {podeTrocarPlano && mensal && (
          <div className="campo"><label htmlFor="ep-periodos">Pagou quanto tempo</label>
            <select id="ep-periodos" value={periodos} onChange={(e) => setPeriodos(e.target.value)}>
              {Array.from({ length: Math.max(12, p.periodos ?? 1) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{rotuloPeriodos(n, plano!.duracaoMeses)}</option>
              ))}
            </select></div>
        )}

        <div className="campo"><label htmlFor="ep-obs">Observação</label>
          <input id="ep-obs" maxLength={200} value={observacao} onChange={(e) => setObservacao(e.target.value)} /></div>

        <p className="form-nota">
          {comRenovacaoDepois
            ? 'Este aluno pagou de novo depois deste pagamento: aqui dá para mudar valor, forma e observação. Para mudar a data, edite primeiro o pagamento mais recente.'
            : p.alteraVencimento
              ? 'Mudar a data, o plano ou o tempo pago recalcula o vencimento do aluno, pela mesma regra do pagamento: em dia emenda no vencimento, atrasado conta da data.'
              : 'Pagamento avulso: mudar a data não mexe em vencimento nenhum.'}
        </p>

        <div className="campo"><label htmlFor="ep-senha">Sua senha</label>
          <input id="ep-senha" type="password" autoComplete="current-password" required
                 value={senha} onChange={(e) => setSenha(e.target.value)} /></div>

        {erro && <div className="form-erro" role="alert">{erro}</div>}
        <button className="btn btn-primary btn-bloco" disabled={enviando || !senha}>
          {enviando ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>
    </Modal>
  );
}
