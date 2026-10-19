import { useCallback, useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao } from '../sessao';
import { contem, ROTULO_NIVEL } from '../dominio';
import { IconeRaio } from '../componentes/Icones';
import { SubTela } from '../componentes/Secao';
import { FichaCartao } from './FichaCartao';
import { FormFicha } from './FormFicha';
import type { FichaTreino } from '../tipos';

const OBJETIVO: Record<string, string> = {
  hipertrofia: 'Hipertrofia', emagrecimento: 'Emagrecimento', definicao: 'Definição',
  condicionamento: 'Condicionamento', saude_geral: 'Saúde geral', reabilitacao: 'Reabilitação',
};

/**
 * Fichas em duas camadas: a lista mostra de quem é, o objetivo, quantos
 * treinos e a situação; a ficha inteira (exercício por exercício, liberar)
 * abre num clique. Antes cada ficha vinha aberta, com o aviso de CREF repetido
 * em todas, e com cinco fichas a tela virava um rolo.
 */
export function Treinos() {
  const { avisar, usuario } = useSessao();
  const [montando, setMontando] = useState(false);
  const { dados: fichas, carregando, erro, recarregar } = useDados(() => api.fichas(), []);
  const { dados: alunos } = useDados(() => api.alunos(), []);
  const { dados: cfg } = useDados(() => api.config(), []);
  const [filtro, setFiltro] = useState<'todas' | 'rascunho' | 'aprovada'>('rascunho');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<number | null>(null);
  const voltar = useCallback(() => setAberta(null), []);

  const nomeDe = (id: number) => alunos?.find((a) => a.id === id)?.nome ?? '';
  const todas = fichas ?? [];
  const pendentes = todas.filter((f) => f.status === 'rascunho').length;
  const lista = todas
    .filter((f) => filtro === 'todas' || f.status === filtro)
    .filter((f) => !alunos || contem(nomeDe(f.alunoId), busca));
  const ficha = aberta != null ? todas.find((f) => f.id === aberta) : null;

  async function tentarIA() {
    try { await api.gerarFichaIA(); } catch (e: any) { avisar(e.message, 'info'); }
  }

  if (ficha) {
    return (
      <div className="container entrar-fundo" key={`ficha-${ficha.id}`}>
        <SubTela origem="Fichas de treino" aoVoltar={voltar} titulo={nomeDe(ficha.alunoId) || 'Ficha de treino'}>
          <div className="ficha-aberta">
            <FichaCartao ficha={ficha} aoMudar={recarregar} />
          </div>
        </SubTela>
      </div>
    );
  }

  return (
    <div className="container entrar" key="lista">
      <div className="sec-head">
        <h2>Fichas de treino</h2>
        {usuario.papel !== 'recepcao' && <button className="btn btn-primary btn-sm" onClick={() => setMontando(true)}>Montar ficha</button>}
      </div>

      {/* a IA ainda não está ligada: uma linha diz isso, sem ocupar a tela */}
      <div className="ia-linha">
        <IconeRaio size={15} />
        <span>
          {cfg?.iaHabilitada
            ? 'A IA sugere um rascunho; um professor revisa e libera.'
            : 'Geração por IA desligada. As fichas são montadas pelo professor em "Montar ficha".'}
        </span>
        {cfg?.iaHabilitada && <button className="btn btn-secondary btn-sm" onClick={tentarIA}>Gerar com IA</button>}
      </div>

      <div className="treinos-filtros">
        <div className="chips filtros-fichas">
          <button className={`chip ${filtro === 'rascunho' ? 'on' : ''}`} onClick={() => setFiltro('rascunho')}>
            Aguardando liberação ({pendentes})
          </button>
          <button className={`chip ${filtro === 'aprovada' ? 'on' : ''}`} onClick={() => setFiltro('aprovada')}>Liberadas</button>
          <button className={`chip ${filtro === 'todas' ? 'on' : ''}`} onClick={() => setFiltro('todas')}>Todas</button>
        </div>
        <div className="busca treinos-busca">
          <input type="search" placeholder="Buscar aluno" value={busca} aria-label="Buscar fichas pelo nome do aluno"
                 onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      {erro && <div className="erro-carga">{erro}</div>}
      {carregando && !fichas && <div className="carregando">Carregando fichas…</div>}
      <div className="fichas-lista escalonar">
        {lista.map((f) => <PreviaFicha key={f.id} ficha={f} aluno={alunos ? nomeDe(f.alunoId) || 'Aluno removido' : '…'} aoAbrir={() => setAberta(f.id)} />)}
      </div>
      {!carregando && !lista.length && (
        <div className="vazio">
          <strong>Nada aqui</strong>{busca ? 'Nenhuma ficha de aluno com esse nome.' : 'Nenhuma ficha neste filtro.'}
        </div>
      )}
      {montando && <FormFicha aoFechar={() => setMontando(false)} aoCriar={() => { setMontando(false); setFiltro('rascunho'); recarregar(); }} />}
    </div>
  );
}

function PreviaFicha({ ficha: f, aluno, aoAbrir }: { ficha: FichaTreino; aluno: string; aoAbrir: () => void }) {
  const exercicios = f.divisoes.reduce((s, d) => s + d.itens.length, 0);
  const rascunho = f.status === 'rascunho';
  return (
    <button type="button" className="ficha-previa" onClick={aoAbrir}>
      <div className="ficha-previa__topo">
        <strong>{aluno}</strong>
        <span className={`badge ${rascunho ? 'b-warn' : 'b-ok'}`}>{rascunho ? 'Rascunho' : 'Liberada'}</span>
      </div>
      <div className="ficha-previa__det">
        {OBJETIVO[f.objetivo] ?? f.objetivo}, {ROTULO_NIVEL[f.nivel as keyof typeof ROTULO_NIVEL] ?? f.nivel}, {f.diasPorSemana}x por semana
      </div>
      <div className="ficha-previa__treinos">
        {f.divisoes.map((d) => <span key={d.id} className="ficha-previa__div">Treino {d.rotulo}<small>{d.foco}</small></span>)}
      </div>
      <div className="ficha-previa__rodape">
        <span>{exercicios} {exercicios === 1 ? 'exercício' : 'exercícios'}, criada em {new Date(f.criadoEm).toLocaleDateString('pt-BR')}</span>
        <span className="ficha-previa__abrir">{rascunho ? 'Revisar e liberar' : 'Abrir ficha'}</span>
      </div>
    </button>
  );
}
