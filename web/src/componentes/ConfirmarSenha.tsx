import { useState } from 'react';
import { Modal } from './Modal';

/**
 * Confirmação com a senha de quem está logado, para o que não tem volta:
 * excluir pagamento, cancelar venda. Quem confere a senha é o servidor; aqui
 * só se pergunta e se mostra o erro que ele devolver.
 */
export function ConfirmarSenha({ titulo, explicacao, rotuloBotao, aoConfirmar, aoFechar }: {
  titulo: string;
  explicacao: React.ReactNode;
  rotuloBotao: string;
  aoConfirmar: (senha: string) => Promise<void>;
  aoFechar: () => void;
}) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setEnviando(true);
    try { await aoConfirmar(senha); }
    catch (err: any) { setErro(err.message); setSenha(''); }
    finally { setEnviando(false); }
  }

  return (
    <Modal titulo={titulo} aoFechar={aoFechar}>
      <form onSubmit={confirmar}>
        <p className="form-nota">{explicacao}</p>
        <div className="campo"><label htmlFor="cs-senha">Sua senha</label>
          <input id="cs-senha" type="password" autoComplete="current-password" autoFocus required
                 value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
        {erro && <div className="form-erro" role="alert">{erro}</div>}
        <button className="btn btn-danger btn-bloco" disabled={enviando || !senha}>
          {enviando ? 'Conferindo…' : rotuloBotao}
        </button>
      </form>
    </Modal>
  );
}
