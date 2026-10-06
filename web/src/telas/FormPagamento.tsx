import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao } from '../sessao';
import { formatarBRL, formatarData, hoje } from '../dominio';
import { linkWhatsapp, mensagemCobranca, mensagemPix, podeAvisarNoWhatsapp } from '../dominio/whatsapp';
import { Modal } from '../componentes/Modal';
import type { Aluno, FormaPagamento, Plano, PreviaPagamento } from '../tipos';

const MAX_PERIODOS = 12;

/**
 * Como escrever a quantidade no seletor. Plano de 1 mês vira "3 meses";
 * plano de 3 meses vira "3 períodos (9 meses)" — ninguém precisa fazer a
 * conta de cabeça no balcão.
 */
function rotuloPeriodos(n: number, duracaoMeses: number): string {
  if (duracaoMeses === 1) return n === 1 ? '1 mês' : `${n} meses`;
  const total = n * duracaoMeses;
  return n === 1 ? `1 período (${duracaoMeses} meses)` : `${n} períodos (${total} meses)`;
}

/** A frase que explica o vencimento que acabou de aparecer na tela. */
function explicarPrevia(p: PreviaPagamento, ehDiaria: boolean): string {
  if (ehDiaria) return 'Vale só este dia. Não mexe na mensalidade nem gera cobrança no mês que vem.';
  if (!p.dataFimAnterior) return 'Primeira matrícula deste aluno: o período começa na data do pagamento.';
  if (p.diasAproveitados > 0) {
    const d = p.diasAproveitados;
    const dias = d === 1 ? 'O dia que faltava entrou' : `Os ${d} dias que faltavam entraram`;
    return `Vencia ${formatarData(p.dataFimAnterior)}. ${dias} no período novo — pagar adiantado não encurta o mês.`;
  }
  return `Estava vencido desde ${formatarData(p.dataFimAnterior)}, então o período novo conta da data do pagamento.`;
}

export function FormPagamento({ aluno, aoFechar, aoPagar }: {
  aluno: Aluno; aoFechar: () => void; aoPagar: () => void;
}) {
  const { avisar } = useSessao();
  const { dados: planos } = useDados(() => api.planos(), []);
  const { dados: cobrancas } = useDados(() => api.cobrancas(), []);
  const { dados: cfg } = useDados(() => api.config(), []);
  const minhas = (cobrancas ?? []).filter((c) => c.alunoId === aluno.id);

  const [cobrancaId, setCobrancaId] = useState('');
  const [planoId, setPlanoId] = useState(aluno.matricula ? String(aluno.matricula.planoId) : '');
  const [forma, setForma] = useState<FormaPagamento>('pix');
  const [pix, setPix] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [pixErro, setPixErro] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // quantos periodos de uma vez: "a moca ja adiantou novembro"
  const [periodos, setPeriodos] = useState(1);
  // por padrao o sistema calcula tudo; quem quiser assume as datas na mao
  const [ajustarDatas, setAjustarDatas] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(hoje());
  const [diaDaDiaria, setDiaDaDiaria] = useState(hoje());
  const [vencimentoManual, setVencimentoManual] = useState('');
  // o vencimento que vai sair, calculado pelo servidor
  const [previa, setPrevia] = useState<PreviaPagamento | null>(null);

  // cobranca em aberto ja vem selecionada: e o caso mais comum no balcao
  useEffect(() => { if (minhas[0] && !cobrancaId) setCobrancaId(String(minhas[0].id)); }, [minhas.length]);

  const cobranca = minhas.find((c) => String(c.id) === cobrancaId);
  const plano: Plano | undefined = planos?.find((p) => String(p.id) === planoId);
  const ehDiaria = !!plano?.duracaoDias;
  const podeAdiantar = !!plano && !ehDiaria;

  // diaria e pagamento avulso nao adiantam periodo
  useEffect(() => { if (!podeAdiantar && periodos !== 1) setPeriodos(1); }, [podeAdiantar]);

  // o periodo extra sai pelo preco do plano; o primeiro pode vir da cobranca em aberto
  const precoPlano = plano?.precoCentavos ?? 0;
  const valor = (cobranca?.valorCentavos ?? precoPlano) + (periodos - 1) * precoPlano;

  // Pix amarrado a cobranca quando existe; senao (renovacao antecipada, plano novo), Pix avulso do valor
  useEffect(() => {
    setPix(null); setQr(null); setPixErro(null);
    if (forma !== 'pix' || !valor) return;
    let vivo = true;
    // adiantamento muda o total, entao o Pix da cobranca nao serve mais
    (cobranca && periodos === 1 ? api.pixDaCobranca(cobranca.id) : api.pixAvulso(valor))
      .then(async (r) => {
        const img = await QRCode.toDataURL(r.payload, { margin: 1, width: 440, errorCorrectionLevel: 'M', color: { dark: '#111318', light: '#FFFFFF' } });
        if (vivo) { setPix(r.payload); setQr(img); }
      })
      .catch((e) => vivo && setPixErro(e.message));
    return () => { vivo = false; };
  }, [forma, cobrancaId, valor, periodos]);

  /**
   * A prévia vem do servidor de propósito: é a MESMA conta que vai ser
   * gravada, não uma cópia da regra aqui na tela que pode desencontrar.
   */
  useEffect(() => {
    if (!plano) { setPrevia(null); return; }
    let vivo = true;
    api.previaPagamento({
      alunoId: aluno.id, planoId: plano.id, periodos,
      ...(ajustarDatas ? {
        dataPagamento,
        dataInicioEscolhida: ehDiaria ? diaDaDiaria : null,
        dataFimManual: vencimentoManual || null,
      } : {}),
    })
      .then((p) => { if (vivo) setPrevia(p); })
      .catch(() => { if (vivo) setPrevia(null); });
    return () => { vivo = false; };
  }, [aluno.id, plano?.id, periodos, ajustarDatas, dataPagamento, diaDaDiaria, vencimentoManual, ehDiaria]);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!valor) { setErro('Escolha um plano ou uma cobrança'); return; }
    setErro(null); setEnviando(true);
    try {
      await api.registrarPagamento({
        alunoId: aluno.id, valorCentavos: valor, forma,
        cobrancaId: cobranca?.id, planoId: plano?.id,
        periodos: podeAdiantar ? periodos : undefined,
        observacao: plano
          ? (periodos > 1 ? `${plano.nome}, ${rotuloPeriodos(periodos, plano.duracaoMeses)} adiantados` : plano.nome)
          : 'Pagamento avulso',
        ...(ajustarDatas ? {
          dataPagamento,
          dataInicioEscolhida: ehDiaria ? diaDaDiaria : null,
          dataFimManual: vencimentoManual || null,
        } : {}),
      });
      avisar(`Pagamento de ${formatarBRL(valor)} registrado`, 'ok');
      aoPagar();
    } catch (err: any) { setErro(err.message); }
    finally { setEnviando(false); }
  }

  const nomeAcademia = cfg?.academia?.nome ?? 'academia';
  const avisoPermitido = podeAvisarNoWhatsapp(aluno);
  const motivoSemAviso = !aluno.aceitaWhatsapp
    ? 'O aluno não autorizou avisos pelo WhatsApp. Marque em Editar, com o aluno de acordo.'
    : 'Este aluno está sem telefone no cadastro.';

  /** Abre a conversa com a mensagem pronta; quem envia e a recepcao. */
  function abrirWhatsapp(texto: string) {
    const url = linkWhatsapp(aluno.telefone, texto);
    if (!url) { avisar('Sem telefone válido para este aluno', 'erro'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <Modal titulo="Registrar pagamento" aoFechar={aoFechar}>
      <p className="form-nota form-nota--quem">{aluno.nome}{aluno.planoNome ? `, ${aluno.planoNome}` : ''}</p>
      <form onSubmit={confirmar}>
        {minhas.length > 0 && (
          <div className="campo"><label htmlFor="fp-cob">Cobrança em aberto</label>
            <select id="fp-cob" value={cobrancaId} onChange={(e) => setCobrancaId(e.target.value)}>
              <option value="">Nenhuma (pagamento avulso)</option>
              {minhas.map((c) => (
                <option key={c.id} value={c.id}>Vence {formatarData(c.vencimento)}, {formatarBRL(c.valorCentavos)}</option>
              ))}
            </select></div>
        )}
        <div className="linha2">
          <div className="campo"><label htmlFor="fp-plano">Renovar plano</label>
            <select id="fp-plano" value={planoId} onChange={(e) => setPlanoId(e.target.value)}>
              <option value="">Não renovar</option>
              {planos?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}{p.duracaoDias ? ` (${p.duracaoDias === 1 ? 'diária' : `${p.duracaoDias} dias`})` : ''}
                </option>
              ))}
            </select></div>
          <div className="campo"><label htmlFor="fp-forma">Forma</label>
            <select id="fp-forma" value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
              <option value="pix">Pix</option><option value="dinheiro">Dinheiro</option>
              <option value="debito">Débito</option><option value="credito">Crédito</option>
            </select></div>
        </div>

        {podeAdiantar && (
          <div className="campo"><label htmlFor="fp-periodos">Está pagando quanto tempo</label>
            <select id="fp-periodos" value={periodos} onChange={(e) => setPeriodos(Number(e.target.value))}>
              {Array.from({ length: MAX_PERIODOS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{rotuloPeriodos(n, plano!.duracaoMeses)}</option>
              ))}
            </select>
            {periodos > 1 && (
              <p className="form-nota previa-venc__extra">
                Adiantamento: {formatarBRL(precoPlano)} × {periodos}. O vencimento anda tudo de uma vez.
              </p>
            )}
          </div>
        )}

        <div className="pagamento-total">
          <span>Total</span><strong>{formatarBRL(valor)}</strong>
        </div>

        {previa && (
          <div className="previa-venc">
            <span className="previa-venc__rot">{ehDiaria ? 'Vale no dia' : 'Novo vencimento'}</span>
            <strong className="previa-venc__data">
              {formatarData(ehDiaria ? previa.dataInicio : previa.dataFim)}
            </strong>
            <p className="previa-venc__nota">{explicarPrevia(previa, ehDiaria)}</p>
          </div>
        )}

        <div className="datas">
          <label className="checkbox-linha">
            <input type="checkbox" checked={ajustarDatas} onChange={(e) => setAjustarDatas(e.target.checked)} />
            Ajustar as datas na mão
          </label>
          {!ajustarDatas ? (
            <p className="form-nota">
              {ehDiaria
                ? 'A diária vale hoje. Marque aqui se o aluno vai vir em outro dia.'
                : plano
                  ? 'Quem paga em dia ou adiantado emenda no vencimento atual e não perde dia nenhum. Quem paga atrasado conta da data do pagamento.'
                  : 'Pagamento avulso: não mexe no vencimento.'}
            </p>
          ) : (
            <div className="linha3">
              <div className="campo"><label htmlFor="fp-data">Pagou em</label>
                <input id="fp-data" type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} /></div>
              {ehDiaria && (
                <div className="campo"><label htmlFor="fp-dia">Dia da diária</label>
                  <input id="fp-dia" type="date" value={diaDaDiaria} onChange={(e) => setDiaDaDiaria(e.target.value)} /></div>
              )}
              <div className="campo"><label htmlFor="fp-venc">Vence em</label>
                <input id="fp-venc" type="date" value={vencimentoManual} min={dataPagamento}
                       onChange={(e) => setVencimentoManual(e.target.value)} />
              </div>
            </div>
          )}
          {ajustarDatas && (
            <p className="form-nota">
              Deixe o campo <b>Vence em</b> vazio para o sistema calcular sozinho, pela regra acima.
            </p>
          )}
        </div>

        {pixErro && forma === 'pix' && <p className="form-nota form-nota--alerta">{pixErro}</p>}
        {pix && (
          <div className="pix-caixa">
            {qr && <img className="pix-caixa__qr" src={qr} alt={`QR code Pix de ${formatarBRL(valor)}`} />}
            <div className="pix-caixa__rot">Pix copia e cola</div>
            <code>{pix}</code>
            <button type="button" className="btn btn-secondary btn-sm"
                    onClick={() => navigator.clipboard?.writeText(pix).then(() => avisar('Código Pix copiado', 'ok'))}>
              Copiar código
            </button>
            <p className="form-nota" style={{ margin: '10px 0 0' }}>
              Só confirme depois de ver o valor <b>no extrato do banco</b>. Print de comprovante se falsifica fácil.
            </p>
          </div>
        )}

        {erro && <div className="form-erro" role="alert">{erro}</div>}
        <button className="btn btn-primary btn-bloco" disabled={enviando || !valor}>
          {enviando ? 'Registrando…' : `Confirmar recebimento de ${formatarBRL(valor)}`}
        </button>

        <div className="aviso-whatsapp">
          <span className="aviso-whatsapp__rot">Avisar o aluno</span>
          <div className="aviso-whatsapp__botoes">
            <button type="button" className="btn btn-secondary btn-sm" disabled={!avisoPermitido || !valor}
                    title={avisoPermitido ? 'Abre o WhatsApp com a mensagem pronta' : motivoSemAviso}
                    onClick={() => abrirWhatsapp(mensagemCobranca({
                      nome: aluno.nome, academia: nomeAcademia, valorCentavos: valor,
                      vencimento: cobranca?.vencimento ?? aluno.matricula?.dataFim ?? null,
                    }))}>
              Enviar lembrete
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={!avisoPermitido || !pix}
                    title={!pix ? 'Escolha a forma Pix para gerar o código' : avisoPermitido ? 'Manda só o código Pix' : motivoSemAviso}
                    onClick={() => pix && abrirWhatsapp(mensagemPix({ nome: aluno.nome, valorCentavos: valor, codigo: pix }))}>
              Enviar código Pix
            </button>
          </div>
          <p className="form-nota">
            {avisoPermitido
              ? 'O WhatsApp abre com o texto escrito; você lê, ajusta se quiser e envia.'
              : motivoSemAviso}
          </p>
        </div>
      </form>
    </Modal>
  );
}
