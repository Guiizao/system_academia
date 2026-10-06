import { useEffect, useState } from 'react';
import { api } from '../dados/api';
import { useSessao } from '../sessao';
import { Modal } from '../componentes/Modal';
import { CampoRestricoes } from '../componentes/CampoRestricoes';
import { FaixaRascunho } from '../componentes/FaixaRascunho';
import { formatarTelefone } from '../dominio';
import { mascararTelefone, mascararCPF, soDigitos } from '../dominio/mascaras';
import { chaveRascunho, lerRascunho, salvarRascunho, limparRascunho } from '../dominio/rascunho';
import type { Aluno } from '../tipos';

export function FormEditarAluno({ aluno, aoFechar, aoSalvar }: { aluno: Aluno; aoFechar: () => void; aoSalvar: () => void }) {
  const { usuario, avisar } = useSessao();
  const original = {
    nome: aluno.nome, telefone: formatarTelefone(aluno.telefone), email: aluno.email ?? '',
    cpf: mascararCPF(aluno.cpf ?? ''), dataNascimento: aluno.dataNascimento ?? '',
    observacoesMedicas: aluno.observacoesMedicas ?? '', aceitaWhatsapp: aluno.aceitaWhatsapp,
    restricoes: aluno.restricoes,
  };
  // edicao interrompida volta de onde parou, por aluno
  const chave = chaveRascunho(usuario.id, 'aluno-editar', aluno.id);
  const [recuperado, setRecuperado] = useState(() => lerRascunho<typeof original>(chave) !== null);
  const [f, setF] = useState(() => ({ ...original, ...(lerRascunho<typeof original>(chave) ?? {}) }));
  const { restricoes } = f;
  const setRestricoes = (v: string[]) => setF((a) => ({ ...a, restricoes: v }));

  useEffect(() => {
    // so guarda o que ficou DIFERENTE do que esta salvo no sistema
    salvarRascunho(chave, JSON.stringify(f) === JSON.stringify(original) ? null : f);
  }, [f, chave]);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const campo = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(null);
    try {
      await api.atualizarAluno(aluno.id, { ...f, telefone: soDigitos(f.telefone), cpf: soDigitos(f.cpf) });
      limparRascunho(chave);
      avisar('Dados atualizados', 'ok'); aoSalvar();
    }
    catch (err: any) { setErro(err.message); }
  }
  async function desativar() {
    try { await api.atualizarAluno(aluno.id, { ativo: false }); avisar(`${aluno.nome.split(' ')[0]} desativado. O histórico foi mantido.`, 'ok'); aoSalvar(); }
    catch (err: any) { setErro(err.message); }
  }

  return (
    <Modal titulo={`Editar ${aluno.nome}`} aoFechar={aoFechar} largo>
      <form onSubmit={salvar}>
        {recuperado && <FaixaRascunho aoDescartar={() => { limparRascunho(chave); setF(original); setRecuperado(false); }} />}
        <div className="campo"><label htmlFor="ea-nome">Nome</label><input id="ea-nome" required value={f.nome} onChange={campo('nome')} /></div>
        <div className="linha2">
          <div className="campo"><label htmlFor="ea-tel">WhatsApp</label><input id="ea-tel" required inputMode="tel" value={f.telefone}
                   onChange={(e) => setF({ ...f, telefone: mascararTelefone(e.target.value) })} /></div>
          <div className="campo"><label htmlFor="ea-email">E-mail</label><input id="ea-email" type="email" value={f.email} onChange={campo('email')} /></div>
        </div>
        <div className="linha2">
          <div className="campo"><label htmlFor="ea-cpf">CPF</label><input id="ea-cpf" inputMode="numeric" placeholder="000.000.000-00" value={f.cpf}
            onChange={(e) => setF({ ...f, cpf: mascararCPF(e.target.value) })} /></div>
          <div className="campo"><label htmlFor="ea-nasc">Nascimento</label><input id="ea-nasc" type="date" value={f.dataNascimento} onChange={campo('dataNascimento')} /></div>
        </div>
        <CampoRestricoes valor={restricoes} aoMudar={setRestricoes} />
        <div className="campo"><label htmlFor="ea-obs">Observações médicas</label><textarea id="ea-obs" value={f.observacoesMedicas} onChange={campo('observacoesMedicas')} /></div>
        <label className="checkbox-linha"><input type="checkbox" checked={f.aceitaWhatsapp} onChange={campo('aceitaWhatsapp')} />Aceita avisos pelo WhatsApp</label>
        {erro && <div className="form-erro" role="alert">{erro}</div>}
        <button className="btn btn-primary btn-bloco">Salvar alterações</button>
      </form>

      {usuario.papel !== 'professor' && (
        <div className="zona-perigo">
          {!confirmando
            ? <button className="btn btn-danger btn-bloco" onClick={() => setConfirmando(true)}>Desativar aluno</button>
            : <>
                <p className="form-nota">O aluno sai das listas, mas pagamentos, check-ins e avaliações ficam guardados.</p>
                <div className="linha2">
                  <button className="btn btn-secondary" onClick={() => setConfirmando(false)}>Cancelar</button>
                  <button className="btn btn-danger" onClick={desativar}>Confirmar desativação</button>
                </div>
              </>}
        </div>
      )}
    </Modal>
  );
}
