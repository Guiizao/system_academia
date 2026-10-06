import { useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao } from '../sessao';
import { Modal } from '../componentes/Modal';
import { DIAS_SEMANA } from '../dominio';

export function FormAula({ diaInicial, aoFechar, aoCriar }: { diaInicial: number; aoFechar: () => void; aoCriar: () => void }) {
  const { avisar } = useSessao();
  const { dados: cfg } = useDados(() => api.config(), []);
  const professores = (cfg?.equipe ?? []).filter((u) => u.papel === 'professor');
  const [v, setV] = useState({ nome: '', diaSemana: diaInicial, hora: '07:00', duracaoMin: 60, vagas: 15, local: '', professor: '' });
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(null);
    try {
      await api.criarAula({
        nome: v.nome, diaSemana: v.diaSemana, hora: v.hora, duracaoMin: v.duracaoMin, vagas: v.vagas,
        local: v.local || undefined, professorUsuarioId: v.professor ? Number(v.professor) : undefined,
      });
      avisar(`Aula de ${v.nome} criada`, 'ok'); aoCriar();
    } catch (err: any) { setErro(err.message); }
  }

  return (
    <Modal titulo="Nova aula" aoFechar={aoFechar}>
      <form onSubmit={salvar}>
        <div className="campo"><label htmlFor="au-nome">Nome</label>
          <input id="au-nome" required autoFocus placeholder="Spinning, Funcional…" value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} /></div>
        <div className="linha2">
          <div className="campo"><label htmlFor="au-dia">Toda</label>
            <select id="au-dia" value={v.diaSemana} onChange={(e) => setV({ ...v, diaSemana: Number(e.target.value) })}>
              {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select></div>
          <div className="campo"><label htmlFor="au-hora">Horário</label>
            <input id="au-hora" type="time" required value={v.hora} onChange={(e) => setV({ ...v, hora: e.target.value })} /></div>
        </div>
        <div className="linha2">
          <div className="campo"><label htmlFor="au-dur">Duração (min)</label>
            <input id="au-dur" type="number" min={10} value={v.duracaoMin} onChange={(e) => setV({ ...v, duracaoMin: Number(e.target.value) })} /></div>
          <div className="campo"><label htmlFor="au-vagas">Vagas</label>
            <input id="au-vagas" type="number" min={1} value={v.vagas} onChange={(e) => setV({ ...v, vagas: Number(e.target.value) })} /></div>
        </div>
        <div className="linha2">
          <div className="campo"><label htmlFor="au-local">Local</label>
            <input id="au-local" placeholder="Sala 2" value={v.local} onChange={(e) => setV({ ...v, local: e.target.value })} /></div>
          <div className="campo"><label htmlFor="au-prof">Professor</label>
            <select id="au-prof" value={v.professor} onChange={(e) => setV({ ...v, professor: e.target.value })}>
              <option value="">A definir</option>
              {professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select></div>
        </div>
        {erro && <div className="form-erro" role="alert">{erro}</div>}
        <button className="btn btn-primary btn-bloco">Criar aula</button>
      </form>
    </Modal>
  );
}
