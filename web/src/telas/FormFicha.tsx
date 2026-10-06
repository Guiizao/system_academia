import { useEffect, useMemo, useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao } from '../sessao';
import { Modal } from '../componentes/Modal';
import { FaixaRascunho } from '../componentes/FaixaRascunho';
import { chaveRascunho, lerRascunho, salvarRascunho, limparRascunho } from '../dominio/rascunho';
import { ROTULO_OBJETIVO, ROTULO_NIVEL } from '../dominio';
import type { Objetivo, Nivel } from '../tipos';

type Item = { exercicioId: number; series: number; reps: string; descansoSeg: number };
type Divisao = { rotulo: string; foco: string; itens: Item[] };
const LETRAS = ['A', 'B', 'C', 'D', 'E'];

export function FormFicha({ alunoInicial, aoFechar, aoCriar }: {
  alunoInicial?: number; aoFechar: () => void; aoCriar: () => void;
}) {
  const { usuario, avisar } = useSessao();
  const { dados: alunos } = useDados(() => api.alunos({ status: 'todos' }), []);
  const { dados: biblioteca } = useDados(() => api.exercicios(), []);
  // Montar ficha e o formulario mais demorado do sistema: perder no meio doi.
  type Guardado = { alunoId: string; objetivo: Objetivo; nivel: Nivel; dias: number; divisoes: Divisao[] };
  const inicial: Guardado = {
    alunoId: alunoInicial ? String(alunoInicial) : '', objetivo: 'hipertrofia', nivel: 'iniciante', dias: 3,
    divisoes: [{ rotulo: 'A', foco: '', itens: [] }, { rotulo: 'B', foco: '', itens: [] }],
  };
  const chave = chaveRascunho(usuario.id, 'ficha', alunoInicial ?? 'novo');
  const guardado = lerRascunho<Guardado>(chave);
  const [recuperado, setRecuperado] = useState(() => guardado !== null);
  const [alunoId, setAlunoId] = useState(guardado?.alunoId ?? inicial.alunoId);
  const [objetivo, setObjetivo] = useState<Objetivo>(guardado?.objetivo ?? inicial.objetivo);
  const [nivel, setNivel] = useState<Nivel>(guardado?.nivel ?? inicial.nivel);
  const [dias, setDias] = useState(guardado?.dias ?? inicial.dias);
  const [divisoes, setDivisoes] = useState<Divisao[]>(guardado?.divisoes ?? inicial.divisoes);

  useEffect(() => {
    const agora: Guardado = { alunoId, objetivo, nivel, dias, divisoes };
    salvarRascunho(chave, JSON.stringify(agora) === JSON.stringify(inicial) ? null : agora);
  }, [alunoId, objetivo, nivel, dias, divisoes, chave]);

  function descartarRascunho() {
    limparRascunho(chave);
    setAlunoId(inicial.alunoId); setObjetivo(inicial.objetivo); setNivel(inicial.nivel);
    setDias(inicial.dias); setDivisoes(inicial.divisoes); setRecuperado(false);
  }
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const aluno = alunos?.find((a) => String(a.id) === alunoId);
  // o que a restricao do aluno proibe nem aparece para escolha
  const { permitidos, ocultos } = useMemo(() => {
    const lista = biblioteca ?? [];
    const restr = aluno?.restricoes ?? [];
    const ok = lista.filter((e) => !e.contraindicacoes.some((c) => restr.includes(c)));
    return { permitidos: ok, ocultos: lista.length - ok.length };
  }, [biblioteca, aluno]);

  const mudar = (i: number, fn: (d: Divisao) => Divisao) => setDivisoes(divisoes.map((d, j) => (j === i ? fn(d) : d)));
  const addItem = (i: number, exercicioId: number) => {
    const e = permitidos.find((x) => x.id === exercicioId);
    if (!e) return;
    mudar(i, (d) => ({ ...d, itens: [...d.itens, { exercicioId, series: e.seriesMin + 1 > e.seriesMax ? e.seriesMax : e.seriesMin + 1, reps: '10-12', descansoSeg: 60 }] }));
  };

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!aluno) { setErro('Escolha o aluno'); return; }
    const validas = divisoes.filter((d) => d.itens.length);
    if (!validas.length) { setErro('Adicione pelo menos um exercício'); return; }
    setEnviando(true);
    try {
      await api.criarFicha({
        alunoId: aluno.id, objetivo, nivel, diasPorSemana: dias,
        divisoes: validas.map((d) => ({ rotulo: d.rotulo, foco: d.foco.trim() || `Treino ${d.rotulo}`, itens: d.itens })),
      });
      limparRascunho(chave);
      avisar('Ficha criada como rascunho. Falta revisar e liberar.', 'ok');
      aoCriar();
    } catch (e: any) { setErro(e.message); }
    finally { setEnviando(false); }
  }

  return (
    <Modal titulo="Montar ficha de treino" aoFechar={aoFechar} largo>
      <form onSubmit={salvar}>
        {recuperado && <FaixaRascunho aoDescartar={descartarRascunho} />}
        <div className="linha2">
          <div className="campo"><label htmlFor="ff-aluno">Aluno</label>
            <select id="ff-aluno" value={alunoId} onChange={(e) => setAlunoId(e.target.value)} required>
              <option value="">Escolha…</option>
              {alunos?.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select></div>
          <div className="campo"><label htmlFor="ff-dias">Dias por semana</label>
            <input id="ff-dias" type="number" min={1} max={7} value={dias} onChange={(e) => setDias(Number(e.target.value))} /></div>
        </div>
        <div className="linha2">
          <div className="campo"><label htmlFor="ff-obj">Objetivo</label>
            <select id="ff-obj" value={objetivo} onChange={(e) => setObjetivo(e.target.value as Objetivo)}>
              {Object.entries(ROTULO_OBJETIVO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="campo"><label htmlFor="ff-nivel">Nível</label>
            <select id="ff-nivel" value={nivel} onChange={(e) => setNivel(e.target.value as Nivel)}>
              {Object.entries(ROTULO_NIVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
        </div>

        {aluno && aluno.restricoes.length > 0 && (
          <p className="form-nota form-nota--alerta">
            Restrições de {aluno.nome.split(' ')[0]}: <b>{aluno.restricoes.join(', ')}</b>.
            {ocultos > 0 && ` ${ocultos} ${ocultos === 1 ? 'exercício ficou oculto' : 'exercícios ficaram ocultos'} por isso.`}
          </p>
        )}

        {divisoes.map((d, i) => (
          <DivisaoEditor key={d.rotulo} d={d} permitidos={permitidos} biblioteca={biblioteca ?? []}
            aoMudar={(fn) => mudar(i, fn)} aoAdicionar={(id) => addItem(i, id)}
            aoRemover={divisoes.length > 1 ? () => setDivisoes(divisoes.filter((_, j) => j !== i)) : undefined} />
        ))}
        {divisoes.length < LETRAS.length && (
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginBottom: 14 }}
            onClick={() => setDivisoes([...divisoes, { rotulo: LETRAS[divisoes.length], foco: '', itens: [] }])}>
            Adicionar treino {LETRAS[divisoes.length]}
          </button>
        )}

        {erro && <div className="form-erro" role="alert">{erro}</div>}
        <button className="btn btn-primary btn-bloco" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar como rascunho'}
        </button>
      </form>
    </Modal>
  );
}

function DivisaoEditor({ d, permitidos, biblioteca, aoMudar, aoAdicionar, aoRemover }: {
  d: Divisao; permitidos: Array<{ id: number; nome: string; grupoMuscular: string; equipamento: string }>;
  biblioteca: Array<{ id: number; nome: string; equipamento: string }>;
  aoMudar: (fn: (d: Divisao) => Divisao) => void; aoAdicionar: (id: number) => void; aoRemover?: () => void;
}) {
  const setItem = (j: number, campo: keyof Item, v: string) =>
    aoMudar((x) => ({ ...x, itens: x.itens.map((it, k) => (k === j ? { ...it, [campo]: campo === 'reps' ? v : Number(v) } : it)) }));
  const grupos = [...new Set(permitidos.map((e) => e.grupoMuscular))];

  return (
    <fieldset className="divisao-editor">
      <div className="divisao-editor__cab">
        <strong>Treino {d.rotulo}</strong>
        <input aria-label={`Foco do treino ${d.rotulo}`} placeholder="Foco (ex.: peito e tríceps)" value={d.foco}
               onChange={(e) => aoMudar((x) => ({ ...x, foco: e.target.value }))} />
        {aoRemover && <button type="button" className="btn btn-ghost btn-sm" onClick={aoRemover}>Remover</button>}
      </div>

      {d.itens.map((it, j) => {
        const e = biblioteca.find((x) => x.id === it.exercicioId);
        return (
          <div key={j} className="item-editor">
            <span className="item-editor__nome">{j + 1}. {e?.nome}<small>{e?.equipamento}</small></span>
            <label>Séries<input type="number" min={1} max={10} value={it.series} onChange={(ev) => setItem(j, 'series', ev.target.value)} /></label>
            <label>Reps<input value={it.reps} onChange={(ev) => setItem(j, 'reps', ev.target.value)} /></label>
            <label>Descanso (s)<input type="number" min={0} step={15} value={it.descansoSeg} onChange={(ev) => setItem(j, 'descansoSeg', ev.target.value)} /></label>
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Tirar exercício"
                    onClick={() => aoMudar((x) => ({ ...x, itens: x.itens.filter((_, k) => k !== j) }))}>Tirar</button>
          </div>
        );
      })}

      <select className="item-editor__add" value="" aria-label={`Adicionar exercício ao treino ${d.rotulo}`}
              onChange={(e) => e.target.value && aoAdicionar(Number(e.target.value))}>
        <option value="">+ Adicionar exercício…</option>
        {grupos.map((g) => (
          <optgroup key={g} label={g}>
            {permitidos.filter((e) => e.grupoMuscular === g).map((e) => <option key={e.id} value={e.id}>{e.nome} ({e.equipamento})</option>)}
          </optgroup>
        ))}
      </select>
    </fieldset>
  );
}
