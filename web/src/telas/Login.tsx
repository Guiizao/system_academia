import { useState } from 'react';
import { api } from '../dados/api';
import type { Usuario } from '../tipos';
import './Login.css';
import { Logo } from '../componentes/Logo';
import '../componentes/Shell.css';

export function Login({ aoEntrar }: { aoEntrar: (u: Usuario) => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setEnviando(true);
    try { aoEntrar((await api.login(email, senha)).usuario); }
    catch (err: any) { setErro(err.message); }
    finally { setEnviando(false); }
  }

  return (
    <div className="login">
      <form className="login__cartao entrar" onSubmit={entrar}>
        <div className="marca">
          <Logo tamanho={34} />
          <span className="marca__nome">DARK <b>FISIC</b></span>
        </div>
        <h1 className="login__titulo">Entrar</h1>
        <p className="login__sub">Use o e-mail e a senha que o dono cadastrou para você.</p>

        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="username" autoFocus required
                 value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete="current-password" required
                 value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>

        {erro && <div className="login__erro" role="alert">{erro}</div>}

        <button className="btn btn-primary btn-bloco" disabled={enviando}>
          {enviando ? <><span className="giro" />Entrando</> : 'Entrar'}
        </button>
        <p className="login__rodape">Esqueceu a senha? Peça ao dono da academia.</p>
      </form>
    </div>
  );
}
