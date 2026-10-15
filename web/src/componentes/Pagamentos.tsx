import { useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao } from '../sessao';
import { formatarData } from '../dominio';
import { Modal } from './Modal';
import { ConfirmarSenha } from './ConfirmarSenha';
import { IconeLapis, IconeLixeira } from './Icones';
import { useValores } from './Valores';
import type { FormaPagamento, PagamentoDetalhe } from '../tipos';
import './Pagamentos.css';

/**
 * Lista de pagamentos com editar e excluir, a MESMA na ficha do aluno e no
 * histórico do Financeiro. Editar e excluir são do dono, com a senha dele:
 * o servidor confere e recalcula o vencimento quando a data ou o plano mudam.
 */

const FORMAS: Array<[FormaPagamento, string]> = [['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['debito', 'Débito'], ['credito', 'Crédito'], ['boleto', 'Boleto']];
const ROTULO_FORMA = Object.fromEntries(FORMAS) as Record<string, string>;

export function ListaPagamentos({ itens, mostrarAluno, aoMudar }: {
  itens: PagamentoDetalhe[];
  /** no histórico geral aparece o nome; na ficha do aluno, não precisa */
  mostrarAluno: boolean;
  aoMudar: () => void;
}) {
  const { usuario, avisar } = useSessao();
  const dono = usuario.papel === 'dono';
  const { formatar: dinheiro } = useValores();
  const [editando, setEditando] = useState<PagamentoDetalhe | null>(null);
  const [excluindo, setExcluindo] = useState<PagamentoDetalhe | null>(null);

  return (
    <>
      <div className="pagamentos">
        {itens.map((p) => (
          <div key={p.id} className="pagamentos__linha">
            <div className="pagamentos__info">
              <div className="pagamentos__titulo">
                {mostrarAluno ? p.alunoNome : (p.planoNome ?? p.observacao ?? 'Pagamento')}
              </div>
              <div className="pagamentos__detalhe">
                {formatarData(p.dataPagamento)}, {ROTULO_FORMA[p.forma] ?? p.forma}
                {mostrarAluno && (p.planoNome ?? p.observacao) ? `, ${p.planoNome ?? p.observacao}` : ''}
              </div>
            </div>
            <strong className="pagamentos__valor valor-ok">{dinheiro(p.valorCentavos)}</strong>
            {dono && (
              <div className="pagamentos__acoes">
                <button type="button" className="icone-btn" onClick={() => setEditando(p)}
                        title="Editar este pagamento" aria-label={`Editar pagamento de ${p.alunoNome}`}>
                  <IconeLapis size={16} />
                </button>
                <button type="button" className="icone-btn icone-btn--perigo" onClick={() => setExcluindo(p)}
                        title="Excluir este pagamento" aria-label={`Excluir pagamento de ${p.alunoNome}`}>
                  <IconeLixeira size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editando && (
        <FormEditarPagamento pagamento={editando} aoFechar={() => setEditando(null)}
                             aoSalvar={(msg) => { setEditando(null); avisar(msg, 'ok'); aoMudar(); }} />
      )}
      {excluindo && (
        <ConfirmarSenha
          titulo="Excluir pagamento"
          rotuloBotao={`Excluir ${dinheiro(excluindo.valorCentavos)} de ${excluindo.alunoNome}`}
          explicacao={excluindo.alteraVencimento
            ? <>O pagamento sai do caixa e o vencimento de <b>{excluindo.alunoNome}</b> volta a ser o de antes dele. Não tem volta.</>
            : <>O pagamento sai do caixa. Não tem volta.</>}
          aoFechar={() => setExcluindo(null)}
          aoConfirmar={async (senha) => {
            const r = await api.excluirPagamento(excluindo.id, senha);
            setExcluindo(null);
            avisar(r.dataFimNova
              ? `Pagamento excluído. ${excluindo.alunoNome} volta a vencer em ${formatarData(r.dataFimNova)}.`
              : 'Pagamento excluído.', 'ok');
            aoMudar();
          }}
        />
      )}
    </>
  );
}

/* ─── editar ─────────────────────────────────────────────── */

function FormEditarPagamento({ pagamento: p, aoFechar, aoSalvar }: {
  pagamento: PagamentoDetalhe; aoFechar: () => void; aoSalvar: (msg: string) => void;
}) {
  const { dados: planos } = useDados(() => api.planos(), []);
  // Data e plano só mudam quando este pagamento é o que gerou o vencimento de
  // hoje (ou quando é avulso e não mexe em vencimento nenhum). Com renovação
  // depois dele, mudar a data embaralharia os períodos seguintes.
  const comRenovacaoDepois = !!p.matriculaId && !p.alteraVencimento;
  const podeTrocarPlano = p.alteraVencimento;

  const [data, setData] = useState(p.dataPagamento);
  const [valor, setValor] = useState((p.valorCentavos / 100).toFixed(2).replace('.', ','));
  const [forma, setForma] = useState<FormaPagamento>(p.forma);
  const [planoId, setPlanoId] = useState(p.planoId ? String(p.planoId) : '');
  const [periodos, setPeriodos] = useState('');      // vazio = manter como está
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
      ...(podeTrocarPlano && mensal && periodos ? { periodos: Number(periodos) } : {}),
      ...(observacao !== (p.observacao ?? '') ? { observacao } : {}),
    };
    if (!Object.keys(mudancas).length) { setErro('Nada foi alterado.'); return; }
    setErro(null); setEnviando(true);
    try {
      const r = await api.editarPagamento(p.id, { senha, ...mudancas });
      aoSalvar(r.dataFimNova ? `Pagamento alterado. Vencimento agora: ${formatarData(r.dataFimNova)}.` : 'Pagamento alterado.');
    } catch (err: any) { setErro(err.message); setSenha(''); }
    finally { setEnviando(false); }
  }

  return (
    <Modal titulo="Editar pagamento" aoFechar={aoFechar}>
      <form onSubmit={salvar}>
        <p className="form-nota form-nota--quem">{p.alunoNome}{p.planoNome ? `, ${p.planoNome}` : ''}</p>

        <div className="linha2">
          <div className="campo"><label htmlFor="ep-data">Data do pagamento</label>
            <input id="ep-data" type="date" required value={data} disabled={comRenovacaoDepois}
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
              <option value="">Manter como está</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n === 1 ? '1 período' : `${n} períodos`}</option>
              ))}
            </select></div>
        )}

        <div className="campo"><label htmlFor="ep-obs">Observação</label>
          <input id="ep-obs" maxLength={200} value={observacao} onChange={(e) => setObservacao(e.target.value)} /></div>

        <p className="form-nota">
          {comRenovacaoDepois
            ? 'Este aluno pagou de novo depois deste pagamento: aqui dá para mudar valor, forma e observação. Para mudar a data, edite primeiro o pagamento mais recente.'
            : p.alteraVencimento
              ? 'Mudar a data ou o plano recalcula o vencimento do aluno, pela mesma regra do pagamento: em dia emenda no vencimento, atrasado conta da data.'
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
