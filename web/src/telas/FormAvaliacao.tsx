import { useEffect, useState } from 'react';
import { api } from '../dados/api';
import { useSessao } from '../sessao';
import { Modal } from '../componentes/Modal';
import { FaixaRascunho } from '../componentes/FaixaRascunho';
import { chaveRascunho, lerRascunho, salvarRascunho, limparRascunho } from '../dominio/rascunho';
import { ROTULO_OBJETIVO, ROTULO_NIVEL, hoje } from '../dominio';
import type { Aluno } from '../tipos';

const MEDIDAS: Array<[string, string]> = [
  ['pesoKg', 'Peso (kg)'], ['alturaM', 'Altura (m)'], ['percGordura', 'Gordura (%)'],
  ['circBraco', 'Braço (cm)'], ['circPeito', 'Peito (cm)'], ['circCintura', 'Cintura (cm)'],
  ['circQuadril', 'Quadril (cm)'], ['circCoxa', 'Coxa (cm)'], ['circOmbros', 'Ombros (cm)'],
];

/** Nova avaliacao: vira historico, nunca sobrescreve a anterior. */
export function FormAvaliacao({ aluno, aoFechar, aoSalvar }: { aluno: Aluno; aoFechar: () => void; aoSalvar: () => void }) {
  const { usuario, avisar } = useSessao();
  const ant = aluno.ultimaAvaliacao;
  const inicial: Record<string, string> = {
    data: hoje(), objetivo: ant?.objetivo ?? 'hipertrofia', nivel: ant?.nivel ?? 'iniciante',
    alturaM: ant?.alturaM ? String(ant.alturaM) : '', observacoes: '',
  };
  // medida tirada e perdida e medida tirada de novo: o rascunho evita isso
  const chave = chaveRascunho(usuario.id, 'avaliacao', aluno.id);
  const [recuperado, setRecuperado] = useState(() => lerRascunho(chave) !== null);
  const [v, setV] = useState<Record<string, string>>(() => ({ ...inicial, ...(lerRascunho<Record<string, string>>(chave) ?? {}) }));
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    salvarRascunho(chave, JSON.stringify(v) === JSON.stringify(inicial) ? null : v);
  }, [v, chave]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(null);
    const corpo: Record<string, unknown> = { data: v.data, objetivo: v.objetivo, nivel: v.nivel, observacoes: v.observacoes || undefined };
    for (const [k] of MEDIDAS) {
      const n = Number((v[k] ?? '').replace(',', '.'));
      if (v[k] && !(n > 0)) { setErro('Medidas precisam ser números maiores que zero'); return; }
      if (v[k]) corpo[k] = n;
    }
    try {
      await api.registrarAvaliacao(aluno.id, corpo);
      limparRascunho(chave);
      avisar('Avaliação registrada', 'ok'); aoSalvar();
    }
    catch (err: any) { setErro(err.message); }
  }

  return (
    <Modal titulo={`Avaliação de ${aluno.nome}`} aoFechar={aoFechar} largo>
      <form onSubmit={salvar}>
        {recuperado && <FaixaRascunho aoDescartar={() => { limparRascunho(chave); setV(inicial); setRecuperado(false); }} />}
        <div className="linha3">
          <div className="campo"><label htmlFor="av-data">Data</label>
            <input id="av-data" type="date" value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} /></div>
          <div className="campo"><label htmlFor="av-obj">Objetivo</label>
            <select id="av-obj" value={v.objetivo} onChange={(e) => setV({ ...v, objetivo: e.target.value })}>
              {Object.entries(ROTULO_OBJETIVO).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
            </select></div>
          <div className="campo"><label htmlFor="av-nivel">Nível</label>
            <select id="av-nivel" value={v.nivel} onChange={(e) => setV({ ...v, nivel: e.target.value })}>
              {Object.entries(ROTULO_NIVEL).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
            </select></div>
        </div>
        <div className="linha3">
          {MEDIDAS.map(([k, rot]) => (
            <div className="campo" key={k}><label htmlFor={`av-${k}`}>{rot}</label>
              <input id={`av-${k}`} inputMode="decimal" value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></div>
          ))}
        </div>
        <div className="campo"><label htmlFor="av-obs">Observações</label>
          <textarea id="av-obs" value={v.observacoes} onChange={(e) => setV({ ...v, observacoes: e.target.value })} /></div>
        <p className="form-nota">Fica no histórico. A avaliação anterior continua lá, para mostrar a evolução.</p>
        {erro && <div className="form-erro" role="alert">{erro}</div>}
        <button className="btn btn-primary btn-bloco">Registrar avaliação</button>
      </form>
    </Modal>
  );
}
