import { useEffect, useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao, pode } from '../sessao';
import { formatarBRL } from '../dominio';
import { mascararTelefone, mascararCPF, soDigitos } from '../dominio/mascaras';
import { chaveRascunho, lerRascunho, salvarRascunho, limparRascunho } from '../dominio/rascunho';
import { Modal } from '../componentes/Modal';
import { CampoRestricoes } from '../componentes/CampoRestricoes';
import { FaixaRascunho } from '../componentes/FaixaRascunho';
import type { FormaPagamento } from '../tipos';

const VAZIO = {
  nome: '', telefone: '', email: '', cpf: '', dataNascimento: '', sexo: '',
  observacoesMedicas: '', aceitaWhatsapp: true, consentimentoLgpd: false,
  planoId: '', formaPagamento: 'pix' as FormaPagamento,
  restricoes: [] as string[],
};

export function FormAluno({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: (id: number) => void }) {
  const { usuario, avisar } = useSessao();
  const { dados: planos } = useDados(() => api.planos(), []);
  // Rascunho: fechar sem querer nao apaga o que ja foi digitado. Lido no
  // inicializador (e nao num efeito) para o StrictMode nao sobrescrever.
  const chave = chaveRascunho(usuario.id, 'aluno');
  const [recuperado, setRecuperado] = useState(() => lerRascunho<typeof VAZIO>(chave) !== null);
  const [f, setF] = useState(() => ({ ...VAZIO, ...(lerRascunho<typeof VAZIO>(chave) ?? {}) }));
  const { restricoes } = f;
  const setRestricoes = (v: string[]) => setF((a) => ({ ...a, restricoes: v }));
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // o consentimento LGPD nao fica guardado: cada cadastro precisa do seu
    const { consentimentoLgpd: _marcado, ...digitado } = f;
    const { consentimentoLgpd: _padrao, ...limpo } = VAZIO;
    const nadaDigitado = JSON.stringify(digitado) === JSON.stringify(limpo);
    salvarRascunho(chave, nadaDigitado ? null : { ...digitado, consentimentoLgpd: false });
  }, [f, chave]);
  const campo = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });

  const podeMatricular = pode.receberPagamento(usuario);
  const plano = planos?.find((p) => String(p.id) === f.planoId);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setEnviando(true);
    try {
      const novo = await api.criarAluno({
        nome: f.nome, telefone: soDigitos(f.telefone),
        email: f.email || undefined, cpf: soDigitos(f.cpf) || undefined,
        dataNascimento: f.dataNascimento || undefined, sexo: f.sexo || undefined,
        observacoesMedicas: f.observacoesMedicas || undefined,
        restricoes, aceitaWhatsapp: f.aceitaWhatsapp, consentimentoLgpd: f.consentimentoLgpd,
        ...(podeMatricular && f.planoId ? { planoId: Number(f.planoId), formaPagamento: f.formaPagamento } : {}),
      });
      limparRascunho(chave);
      avisar(`Cadastro de ${novo.nome.split(' ')[0]} concluído`, 'ok');
      aoCriar(novo.id);
    } catch (err: any) { setErro(err.message); }
    finally { setEnviando(false); }
  }

  return (
    <Modal titulo="Cadastrar aluno" aoFechar={aoFechar} largo>
      <form onSubmit={salvar}>
        {recuperado && <FaixaRascunho aoDescartar={() => { limparRascunho(chave); setF(VAZIO); setRecuperado(false); }} />}
        <div className="campo"><label htmlFor="fa-nome">Nome completo *</label>
          <input id="fa-nome" required autoFocus value={f.nome} onChange={campo('nome')} /></div>
        <div className="linha2">
          <div className="campo"><label htmlFor="fa-tel">WhatsApp *</label>
            <input id="fa-tel" required inputMode="tel" placeholder="(11) 9 9999-9999" value={f.telefone}
                   onChange={(e) => setF({ ...f, telefone: mascararTelefone(e.target.value) })} /></div>
          <div className="campo"><label htmlFor="fa-email">E-mail</label>
            <input id="fa-email" type="email" value={f.email} onChange={campo('email')} /></div>
        </div>
        <div className="linha2">
          <div className="campo"><label htmlFor="fa-cpf">CPF</label>
            <input id="fa-cpf" inputMode="numeric" placeholder="000.000.000-00" value={f.cpf}
                   onChange={(e) => setF({ ...f, cpf: mascararCPF(e.target.value) })} /></div>
          <div className="campo"><label htmlFor="fa-nasc">Nascimento</label>
            <input id="fa-nasc" type="date" value={f.dataNascimento} onChange={campo('dataNascimento')} /></div>
        </div>

        <CampoRestricoes valor={restricoes} aoMudar={setRestricoes} />
        <div className="campo"><label htmlFor="fa-obs">Observações médicas</label>
          <textarea id="fa-obs" placeholder="Detalhes para o professor ler" value={f.observacoesMedicas} onChange={campo('observacoesMedicas')} /></div>

        {podeMatricular && (
          <div className="linha2">
            <div className="campo"><label htmlFor="fa-plano">Plano (opcional)</label>
              <select id="fa-plano" value={f.planoId} onChange={campo('planoId')}>
                <option value="">Sem matrícula agora</option>
                {planos?.map((p) => <option key={p.id} value={p.id}>{p.nome}, {formatarBRL(p.precoCentavos)}</option>)}
              </select></div>
            <div className="campo"><label htmlFor="fa-forma">Pagamento</label>
              <select id="fa-forma" value={f.formaPagamento} onChange={campo('formaPagamento')} disabled={!f.planoId}>
                <option value="pix">Pix</option><option value="dinheiro">Dinheiro</option>
                <option value="debito">Débito</option><option value="credito">Crédito</option>
              </select></div>
          </div>
        )}
        {plano && <p className="form-nota">Registra o pagamento de {formatarBRL(plano.precoCentavos)} e já abre a matrícula.</p>}

        <label className="checkbox-linha">
          <input type="checkbox" checked={f.aceitaWhatsapp} onChange={campo('aceitaWhatsapp')} />
          Aceita receber avisos de vencimento e cobrança pelo WhatsApp
        </label>
        <label className="checkbox-linha">
          <input type="checkbox" checked={f.consentimentoLgpd} onChange={campo('consentimentoLgpd')} />
          <span>O aluno autorizou o registro de medidas e restrições de saúde (<b>dado sensível pela LGPD</b>) *</span>
        </label>

        {erro && <div className="form-erro" role="alert">{erro}</div>}
        <button className="btn btn-primary btn-bloco" disabled={enviando || !f.consentimentoLgpd}>
          {enviando ? 'Salvando…' : 'Cadastrar aluno'}
        </button>
      </form>
    </Modal>
  );
}
