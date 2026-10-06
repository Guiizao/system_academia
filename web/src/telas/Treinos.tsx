import { useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao } from '../sessao';
import { IconeRaio } from '../componentes/Icones';
import { FichaCartao } from './FichaCartao';
import { FormFicha } from './FormFicha';

export function Treinos() {
  const { avisar, usuario } = useSessao();
  const [montando, setMontando] = useState(false);
  const { dados: fichas, carregando, erro, recarregar } = useDados(() => api.fichas(), []);
  const { dados: alunos } = useDados(() => api.alunos(), []);
  const { dados: cfg } = useDados(() => api.config(), []);
  const [filtro, setFiltro] = useState<'todas' | 'rascunho' | 'aprovada'>('rascunho');

  const nomeDe = (id: number) => alunos?.find((a) => a.id === id)?.nome;
  const lista = (fichas ?? []).filter((f) => filtro === 'todas' || f.status === filtro);
  const pendentes = (fichas ?? []).filter((f) => f.status === 'rascunho').length;

  async function tentarIA() {
    try { await api.gerarFichaIA(); } catch (e: any) { avisar(e.message, 'info'); }
  }

  return (
    <div className="container entrar">
      <div className="sec-head">
        <h2>Fichas de treino</h2>
        {usuario.papel !== 'recepcao' && <button className="btn btn-primary btn-sm" onClick={() => setMontando(true)}>Montar ficha</button>}
      </div>

      <div className="card ia-cartao">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <IconeRaio size={15} /><strong style={{ fontSize: 14 }}>Geração por IA</strong>
          <span className={`badge ${cfg?.iaHabilitada ? 'b-ok' : 'b-mudo'}`} style={{ marginLeft: 'auto' }}>
            {cfg?.iaHabilitada ? 'Ativa' : 'Desativada'}
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          Desligada por enquanto. Enquanto isso, as fichas são montadas pelo professor em
          "Montar ficha". Quando for ligada, a IA vai sugerir um rascunho, que continua
          precisando de revisão e liberação de um professor.
        </p>
        <button className="btn btn-secondary btn-bloco" style={{ marginTop: 12 }} onClick={tentarIA} disabled={!cfg?.iaHabilitada}>
          Gerar ficha com IA
        </button>
      </div>

      <div className="chips filtros-fichas">
        <button className={`chip ${filtro === 'rascunho' ? 'on' : ''}`} onClick={() => setFiltro('rascunho')}>
          Aguardando liberação ({pendentes})
        </button>
        <button className={`chip ${filtro === 'aprovada' ? 'on' : ''}`} onClick={() => setFiltro('aprovada')}>Liberadas</button>
        <button className={`chip ${filtro === 'todas' ? 'on' : ''}`} onClick={() => setFiltro('todas')}>Todas</button>
      </div>

      {erro && <div className="erro-carga">{erro}</div>}
      {carregando && <div className="carregando">Carregando fichas…</div>}
      <div className="fichas-grade">
        {lista.map((f) => <FichaCartao key={f.id} ficha={f} alunoNome={nomeDe(f.alunoId)} aoMudar={recarregar} />)}
      </div>
      {!carregando && !lista.length && <div className="vazio"><strong>Nada aqui</strong>Nenhuma ficha neste filtro.</div>}
      {montando && <FormFicha aoFechar={() => setMontando(false)} aoCriar={() => { setMontando(false); setFiltro('rascunho'); recarregar(); }} />}
    </div>
  );
}
