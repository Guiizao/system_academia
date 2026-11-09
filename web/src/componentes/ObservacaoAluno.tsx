import { useState } from 'react';
import { api } from '../dados/api';
import { useSessao } from '../sessao';
import type { Aluno } from '../tipos';
import { IconeAlerta, IconeLapis } from './Icones';

/** Recado livre sobre o aluno: amarelo na ficha e um alerta ao lado do nome na lista. */
export function ObservacaoAluno({ aluno, aoMudar }: { aluno: Aluno; aoMudar: () => void }) {
  const { avisar } = useSessao();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const abrir = () => { setTexto(aluno.observacao ?? ''); setEditando(true); };

  async function salvar() {
    setEnviando(true);
    try {
      await api.atualizarAluno(aluno.id, { observacao: texto });
      setEditando(false);
      aoMudar();
    } catch (e: any) { avisar(e.message, 'erro'); }
    finally { setEnviando(false); }
  }

  if (editando) {
    return (
      <div className="perfil__obs perfil__obs--editando">
        <label className="so-leitor" htmlFor="obs-aluno">Observação</label>
        <textarea id="obs-aluno" value={texto} maxLength={500} rows={3} autoFocus
                  placeholder="Ex.: combinou de pagar dia 15" onChange={(e) => setTexto(e.target.value)} />
        <div className="perfil__obs-acoes">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditando(false)}>Cancelar</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={salvar} disabled={enviando}>
            {enviando ? 'Salvando…' : texto.trim() ? 'Salvar' : 'Apagar observação'}
          </button>
        </div>
      </div>
    );
  }

  if (!aluno.observacao) {
    return <button type="button" className="link-btn perfil__obs-nova" onClick={abrir}>Adicionar observação</button>;
  }

  return (
    <div className="perfil__obs">
      <IconeAlerta size={15} />
      <p>{aluno.observacao}</p>
      <button type="button" className="icone-btn" onClick={abrir} aria-label="Editar observação" title="Editar observação"><IconeLapis size={15} /></button>
    </div>
  );
}
