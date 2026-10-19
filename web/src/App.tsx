import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shell, type Tela } from './componentes/Shell';
import { Dashboard } from './telas/Dashboard';
import { Alunos, type AcaoAlunos } from './telas/Alunos';
import { Treinos } from './telas/Treinos';
import { Agenda } from './telas/Agenda';
import { Financeiro } from './telas/Financeiro';
import { Produtos } from './telas/Produtos';
import { Config } from './telas/Config';
import { Login } from './telas/Login';
import { BarraJanela } from './componentes/BarraJanela';
import { EVENTO_COMEMORAR } from './componentes/Bonequinho';
import { limparRascunhosDoUsuario } from './dominio/rascunho';
import { api } from './dados/api';
import { quandoPerderSessao } from './dados/cliente';
import { SessaoCtx } from './sessao';
import type { Usuario } from './tipos';

type Estado = { fase: 'verificando' } | { fase: 'fora' } | { fase: 'dentro'; usuario: Usuario };

export default function App() {
  const [estado, setEstado] = useState<Estado>({ fase: 'verificando' });
  const [tela, setTela] = useState<Tela>('inicio');
  const [alunoFoco, setAlunoFoco] = useState<number | null>(null);
  const [acaoAlunos, setAcaoAlunos] = useState<{ tipo: AcaoAlunos; vez: number } | null>(null);
  // abrir um aluno nao carrega a acao de um atalho antigo (reabriria o cadastro)
  const abrirAluno = useCallback((id: number) => { setAcaoAlunos(null); setAlunoFoco(id); setTela('alunos'); }, []);
  const fazerEmAlunos = useCallback((tipo: AcaoAlunos) => {
    setAlunoFoco(null); setAcaoAlunos({ tipo, vez: Date.now() }); setTela('alunos');
  }, []);
  const [aviso, setAviso] = useState<{ msg: string; tom: string; id: number } | null>(null);

  const avisar = useCallback((msg: string, tom: 'ok' | 'erro' | 'info' = 'info', opcoes?: { semFesta?: boolean }) => {
    const id = Date.now();
    setAviso({ msg, tom, id });
    // deu certo: o boneco comemora junto com o aviso
    if (tom === 'ok' && !opcoes?.semFesta) window.dispatchEvent(new Event(EVENTO_COMEMORAR));
    // so some o aviso que ainda e o atual: um novo nao e apagado pelo timer do anterior
    window.setTimeout(() => setAviso((a) => (a?.id === id ? null : a)), 2800);
  }, []);

  // sessao existente (cookie) ao abrir; qualquer 401 depois volta ao login
  useEffect(() => {
    quandoPerderSessao(() => setEstado({ fase: 'fora' }));
    api.eu().then((r) => setEstado({ fase: 'dentro', usuario: r.usuario }))
      .catch(() => setEstado({ fase: 'fora' }));
  }, []);

  const sair = useCallback(() => {
    // rascunho e de quem digitou: nao fica para o proximo turno
    if (estado.fase === 'dentro') limparRascunhosDoUsuario(estado.usuario.id);
    api.logout().finally(() => { setEstado({ fase: 'fora' }); setTela('inicio'); });
  }, [estado]);

  const sessao = useMemo(
    () => estado.fase === 'dentro' ? { usuario: estado.usuario, sair, avisar } : null,
    [estado, sair, avisar],
  );

  if (estado.fase === 'verificando') return <BarraJanela />;
  if (estado.fase === 'fora' || !sessao) {
    return <><BarraJanela /><Login aoEntrar={(u) => { setEstado({ fase: 'dentro', usuario: u }); setTela('inicio'); }} /></>;
  }

  return (
    <SessaoCtx.Provider value={sessao}>
      <BarraJanela />
      <Shell tela={tela} aoNavegar={(t) => { setAlunoFoco(null); setAcaoAlunos(null); setTela(t); }} aoAbrirAluno={abrirAluno}>
        {tela === 'inicio' && <Dashboard aoNavegar={(t) => { setAcaoAlunos(null); setTela(t); }} aoAbrirAluno={abrirAluno} aoAcaoAlunos={fazerEmAlunos} />}
        {tela === 'alunos' && <Alunos focoId={alunoFoco} acao={acaoAlunos} />}
        {tela === 'treinos' && <Treinos />}
        {tela === 'agenda' && <Agenda />}
        {tela === 'financeiro' && <Financeiro />}
        {tela === 'produtos' && <Produtos />}
        {tela === 'config' && <Config />}
      </Shell>
      {aviso && <div key={aviso.id} className={`aviso aviso--${aviso.tom}`} role="status">{aviso.msg}</div>}
    </SessaoCtx.Provider>
  );
}
