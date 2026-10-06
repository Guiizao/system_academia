import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao } from '../sessao';
import { formatarBRL, formatarData, hoje } from '../dominio';
import { linkWhatsapp, mensagemCobranca, mensagemPix, podeAvisarNoWhatsapp } from '../dominio/whatsapp';
import { Modal } from '../componentes/Modal';
import type { Aluno, FormaPagamento } from '../tipos';

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
  // por padrao o sistema calcula tudo; quem quiser assume as datas na mao
  const [ajustarDatas, setAjustarDatas] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(hoje());
  const [diaDaDiaria, setDiaDaDiaria] = useState(hoje());
  const [vencimentoManual, setVencimentoManual] = useState('');

  // cobranca em aberto ja vem selecionada: e o caso mais comum no balcao
  useEffect(() => { if (minhas[0] && !cobrancaId) setCobrancaId(String(minhas[0].id)); }, [minhas.length]);

  const cobranca = minhas.find((c) => String(c.id) === cobrancaId);
  const plano = planos?.find((p) => String(p.id) === planoId);
  const ehDiaria = !!plano?.duracaoDias;
  const valor = cobranca?.valorCentavos ?? plano?.precoCentavos ?? 0;

  // Pix amarrado a cobranca quando existe; senao (renovacao antecipada, plano novo), Pix avulso do valor
  useEffect(() => {
    setPix(null); setQr(null); setPixErro(null);
    if (forma !== 'pix' || !valor) return;
    let vivo = true;
    (cobranca ? api.pixDaCobranca(cobranca.id) : api.pixAvulso(valor))
      .then(async (r) => {
        const img = await QRCode.toDataURL(r.payload, { margin: 1, width: 440, errorCorrectionLevel: 'M', color: { dark: '#111318', light: '#FFFFFF' } });
        if (vivo) { setPix(r.payload); setQr(img); }
      })
      .catch((e) => vivo && setPixErro(e.message));
    return () => { vivo = false; };
  }, [forma, cobrancaId, valor]);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!valor) { setErro('Escolha um plano ou uma cobrança'); return; }
    setErro(null); setEnviando(true);
    try {
      await api.registrarPagamento({
        alunoId: aluno.id, valorCentavos: valor, forma,
        cobrancaId: cobranca?.id, planoId: plano?.id,
        observacao: plano ? plano.nome : 'Pagamento avulso',
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

        <div className="pagamento-total">
          <span>Total</span><strong>{formatarBRL(valor)}</strong>
        </div>

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
                  ? 'O vencimento é calculado: paga em dia emenda no vencimento atual; paga atrasado conta da data do pagamento.'
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
              Deixe "Vence em" vazio para o sistema calcular sozinho a partir da data do pagamento.
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
