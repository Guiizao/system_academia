import { useMemo, useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao } from '../sessao';
import { DIAS_SEMANA, DIAS_CURTOS, hoje } from '../dominio';
import { linkGrupoWhatsapp, mensagemConviteAula } from '../dominio/whatsapp';
import { Modal } from '../componentes/Modal';
import type { AulaDoDia } from '../tipos';
import { FormAula } from './FormAula';
import './Agenda.css';

function somarDias(d: string, n: number) {
  const [a, m, dia] = d.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, dia + n)).toISOString().slice(0, 10);
}
const dow = (d: string) => { const [a, m, dia] = d.split('-').map(Number); return new Date(Date.UTC(a, m - 1, dia)).getUTCDay(); };

export function Agenda() {
  const { avisar, usuario } = useSessao();
  const [criando, setCriando] = useState(false);
  const H = hoje();
  const [data, setData] = useState(H);
  const [inscrevendo, setInscrevendo] = useState<AulaDoDia | null>(null);
  const proximos = useMemo(() => Array.from({ length: 7 }, (_, i) => somarDias(H, i)), [H]);
  const { dados: aulas, carregando, recarregar } = useDados(() => api.aulasDoDia(data), [data]);
  const { dados: cfg } = useDados(() => api.config(), []);

  /** Abre o WhatsApp com o convite pronto; a pessoa escolhe o grupo e envia. */
  function convidar(a: AulaDoDia) {
    const texto = mensagemConviteAula({
      academia: cfg?.academia?.nome ?? 'academia', nome: a.nome, data, hora: a.hora,
      local: a.local ?? 'na academia', vagasLivres: a.vagas - a.inscritos,
    });
    window.open(linkGrupoWhatsapp(texto), '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="container entrar">
      <div className="sec-head">
        <h2>Agenda de aulas</h2>
        {usuario.papel !== 'recepcao' && <button className="btn btn-primary btn-sm" onClick={() => setCriando(true)}>Nova aula</button>}
      </div>

      <div className="tira-dias">
        {proximos.map((d) => (
          <button key={d} className={`dia ${data === d ? 'on' : ''}`} onClick={() => setData(d)}>
            <span className="dia__dow">{DIAS_CURTOS[dow(d)]}</span>
            <span className="dia__num">{Number(d.slice(8, 10))}</span>
          </button>
        ))}
      </div>

      <div className="sec-head" style={{ paddingTop: 4 }}>
        <h2 style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>
          {data === H ? 'Hoje' : DIAS_SEMANA[dow(data)]}, {data.slice(8, 10)}/{data.slice(5, 7)}
        </h2>
      </div>

      <div className="aulas">
        {carregando && <div className="carregando">Carregando…</div>}
        {aulas?.map((a) => {
          const pct = Math.round((a.inscritos / a.vagas) * 100);
          const lotada = a.inscritos >= a.vagas;
          const cor = lotada ? 'var(--danger)' : pct > 80 ? 'var(--warn)' : 'var(--ok)';
          return (
            <div key={a.id} className="aula">
              <div className="aula__hora">{a.hora}</div>
              <div className="aula__barra" />
              <div className="aula__info">
                <div className="aula__nome">{a.nome}</div>
                <div className="aula__det">{a.professorNome ?? 'Professor a definir'}, {a.local}, {a.duracaoMin} min</div>
                <div className="aula__cap">
                  <div className="aula__trilho"><div className="aula__fill" style={{ width: `${pct}%`, background: cor }} /></div>
                  <span style={{ color: cor, fontSize: 12, fontWeight: 700 }}>{lotada ? 'Lotada' : `${a.inscritos}/${a.vagas}`}</span>
                </div>
              </div>
              <div className="aula__acoes">
                <button className="btn btn-secondary btn-sm" onClick={() => setInscrevendo(a)} disabled={lotada}
                        title={lotada ? 'Aula lotada' : 'Inscrever aluno'}>Inscrever</button>
                {!lotada && (
                  <button className="btn btn-ghost btn-sm" onClick={() => convidar(a)}
                          title="Abre o WhatsApp com o convite pronto para mandar no grupo">Convidar</button>
                )}
              </div>
            </div>
          );
        })}
        {!carregando && !aulas?.length && <div className="vazio"><strong>Sem aulas neste dia</strong>{usuario.papel !== 'recepcao' ? 'Use "Nova aula" para criar uma aula que se repete toda semana.' : ''}</div>}
      </div>

      {criando && <FormAula diaInicial={dow(data)} aoFechar={() => setCriando(false)}
                            aoCriar={() => { setCriando(false); recarregar(); }} />}
      {inscrevendo && (
        <FormInscricao aula={inscrevendo} aoFechar={() => setInscrevendo(null)}
                       aoInscrever={(nome) => { setInscrevendo(null); avisar(`Inscrição de ${nome} confirmada`, 'ok'); recarregar(); }}
                       aoErro={(m) => avisar(m, 'erro')} />
      )}
    </div>
  );
}

function FormInscricao({ aula, aoFechar, aoInscrever, aoErro }: {
  aula: AulaDoDia; aoFechar: () => void; aoInscrever: (nome: string) => void; aoErro: (m: string) => void;
}) {
  const [busca, setBusca] = useState('');
  const { dados: alunos } = useDados(() => api.alunos({ busca }), [busca]);
  // quem ja esta nesta sessao aparece marcado, em vez de falhar so depois do clique
  const { dados: jaInscritos } = useDados(() => api.inscritosDaAula(aula.id, aula.data), [aula.id, aula.data]);
  async function inscrever(id: number, nome: string) {
    try { await api.inscrever(aula.id, id, aula.data); aoInscrever(nome.split(' ')[0]); }
    catch (e: any) { aoErro(e.message); }
  }
  return (
    <Modal titulo={`${aula.nome}, ${aula.hora}`} aoFechar={aoFechar}>
      <p className="form-nota">{aula.vagas - aula.inscritos} vagas livres. Escolha o aluno:</p>
      <div className="campo"><input autoFocus placeholder="Buscar aluno" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
      {alunos?.filter((a) => a.status !== 'inativo').slice(0, 8).map((a) => {
        const jaEsta = jaInscritos?.includes(a.id);
        return (
          <button key={a.id} className="aluno-item" disabled={jaEsta} onClick={() => inscrever(a.id, a.nome)}>
            <div className="aluno-item__info"><div className="aluno-item__nome">{a.nome}</div></div>
            {jaEsta && <span className="badge b-mudo">Já inscrito</span>}
          </button>
        );
      })}
    </Modal>
  );
}
