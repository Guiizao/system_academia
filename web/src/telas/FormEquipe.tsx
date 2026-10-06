import { useState } from 'react';
import { api } from '../dados/api';
import { useSessao } from '../sessao';
import { Modal } from '../componentes/Modal';
import type { Membro, Papel } from '../tipos';

const PAPEIS: Array<[Papel, string, string]> = [
  ['dono', 'Dono', 'Vê e altera tudo, inclusive dinheiro, preços e equipe'],
  ['recepcao', 'Recepção', 'Alunos, check-in e pagamentos. Não vê receita nem preços'],
  ['professor', 'Professor', 'Alunos, avaliações e fichas de treino. Não vê dinheiro'],
];

/** Cadastrar (membro ausente) ou editar alguem da equipe. So o dono chega aqui. */
export function FormMembro({ membro, aoFechar, aoSalvar }: { membro?: Membro; aoFechar: () => void; aoSalvar: () => void }) {
  const { usuario, avisar } = useSessao();
  const [v, setV] = useState({
    nome: membro?.nome ?? '', email: membro?.email ?? '', papel: (membro?.papel ?? 'recepcao') as Papel,
    cref: membro?.cref ?? '', especialidade: membro?.especialidade ?? '', senha: '',
  });
  const [erro, setErro] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const eu = membro?.id === usuario.id;

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(null);
    try {
      if (membro) {
        await api.atualizarMembro(membro.id, { nome: v.nome, papel: v.papel, cref: v.cref || null, especialidade: v.especialidade || null });
        avisar('Dados atualizados', 'ok');
      } else {
        await api.criarMembro({ nome: v.nome, email: v.email, papel: v.papel, senhaInicial: v.senha, cref: v.cref || undefined, especialidade: v.especialidade || undefined });
        avisar(`${v.nome.split(' ')[0]} cadastrado na equipe`, 'ok');
      }
      aoSalvar();
    } catch (err: any) { setErro(err.message); }
  }
  async function alternarAtivo() {
    try { await api.atualizarMembro(membro!.id, { ativo: !membro!.ativo }); avisar(membro!.ativo ? 'Acesso bloqueado' : 'Acesso liberado', 'ok'); aoSalvar(); }
    catch (err: any) { setErro(err.message); }
  }
  async function redefinir() {
    try { await api.redefinirSenha(membro!.id, novaSenha); avisar('Senha redefinida. Passe a nova senha para a pessoa.', 'ok'); aoSalvar(); }
    catch (err: any) { setErro(err.message); }
  }

  return (
    <Modal titulo={membro ? membro.nome : 'Cadastrar na equipe'} aoFechar={aoFechar}>
      <form onSubmit={salvar}>
        <div className="campo"><label htmlFor="eq-nome">Nome</label><input id="eq-nome" required autoFocus value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} /></div>
        {!membro && <div className="campo"><label htmlFor="eq-email">E-mail (é o login)</label><input id="eq-email" type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></div>}
        <div className="campo"><label>Papel</label>
          <div className="papeis">
            {PAPEIS.map(([id, rot, desc]) => (
              <label key={id} className={`papel ${v.papel === id ? 'on' : ''}`}>
                <input type="radio" name="papel" value={id} checked={v.papel === id} disabled={eu} onChange={() => setV({ ...v, papel: id })} />
                <strong>{rot}</strong><small>{desc}</small>
              </label>
            ))}
          </div>
        </div>
        {v.papel !== 'recepcao' && (
          <>
            <div className="linha2">
              <div className="campo"><label htmlFor="eq-cref">CREF</label>
                <input id="eq-cref" placeholder="000000-G/SP" value={v.cref} onChange={(e) => setV({ ...v, cref: e.target.value })} /></div>
              <div className="campo"><label htmlFor="eq-esp">Especialidade</label>
                <input id="eq-esp" value={v.especialidade} onChange={(e) => setV({ ...v, especialidade: e.target.value })} /></div>
            </div>
            {!v.cref.trim() && (
              <p className="form-nota form-nota--alerta">
                Sem CREF a pessoa libera ficha do mesmo jeito, mas cada ficha dela fica registrada como
                liberada sem CREF. Prescrever exercício é atividade de profissional de Educação Física
                (Lei 9.696/1998).
              </p>
            )}
          </>
        )}
        {!membro && <div className="campo"><label htmlFor="eq-senha">Senha inicial (mín. 10 caracteres)</label>
          <input id="eq-senha" type="password" required minLength={10} value={v.senha} onChange={(e) => setV({ ...v, senha: e.target.value })} /></div>}
        {erro && <div className="form-erro" role="alert">{erro}</div>}
        <button className="btn btn-primary btn-bloco">{membro ? 'Salvar alterações' : 'Cadastrar'}</button>
      </form>

      {membro && !eu && (
        <div className="zona-perigo">
          <div className="campo"><label htmlFor="eq-nova">Esqueceu a senha? Defina uma nova</label>
            <div className="linha2"><input id="eq-nova" type="password" minLength={10} placeholder="Nova senha" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
              <button className="btn btn-secondary" disabled={novaSenha.length < 10} onClick={redefinir}>Redefinir senha</button></div></div>
          <button className={`btn btn-bloco ${membro.ativo ? 'btn-danger' : 'btn-secondary'}`} onClick={alternarAtivo}>
            {membro.ativo ? 'Bloquear acesso' : 'Liberar acesso'}
          </button>
        </div>
      )}
    </Modal>
  );
}

export function FormSenha({ aoFechar }: { aoFechar: () => void }) {
  const { avisar } = useSessao();
  const [v, setV] = useState({ atual: '', nova: '', repete: '' });
  const [erro, setErro] = useState<string | null>(null);
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(null);
    if (v.nova !== v.repete) { setErro('As duas senhas novas não são iguais'); return; }
    try { await api.trocarMinhaSenha(v.atual, v.nova); avisar('Senha trocada. Outros aparelhos vão pedir login de novo.', 'ok'); aoFechar(); }
    catch (err: any) { setErro(err.message); }
  }
  return (
    <Modal titulo="Trocar minha senha" aoFechar={aoFechar}>
      <form onSubmit={salvar}>
        <div className="campo"><label htmlFor="s-atual">Senha atual</label><input id="s-atual" type="password" required autoFocus value={v.atual} onChange={(e) => setV({ ...v, atual: e.target.value })} /></div>
        <div className="campo"><label htmlFor="s-nova">Nova senha (mín. 10 caracteres)</label><input id="s-nova" type="password" required minLength={10} value={v.nova} onChange={(e) => setV({ ...v, nova: e.target.value })} /></div>
        <div className="campo"><label htmlFor="s-rep">Repita a nova senha</label><input id="s-rep" type="password" required value={v.repete} onChange={(e) => setV({ ...v, repete: e.target.value })} /></div>
        {erro && <div className="form-erro" role="alert">{erro}</div>}
        <button className="btn btn-primary btn-bloco">Trocar senha</button>
      </form>
    </Modal>
  );
}
