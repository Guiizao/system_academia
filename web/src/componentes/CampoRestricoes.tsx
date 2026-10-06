import { useState } from 'react';
import { TAGS_PADRAO, adicionarRestricao, alternarRestricao, ehTagPadrao, LIMITE_RESTRICOES } from '../dominio/restricoes';

/**
 * Restricoes medicas: as tags conhecidas em cima e, no "+", o que a lista nao
 * cobre. O texto escrito a mao fica registrado e aparece para o professor,
 * mas nao filtra exercicio -- a tela diz isso em vez de deixar parecer que
 * protege.
 */
export function CampoRestricoes({ valor, aoMudar }: { valor: string[]; aoMudar: (v: string[]) => void }) {
  const [escrevendo, setEscrevendo] = useState(false);
  const [texto, setTexto] = useState('');
  const proprias = valor.filter((r) => !ehTagPadrao(r));
  const cheio = valor.length >= LIMITE_RESTRICOES;

  function acrescentar() {
    const nova = adicionarRestricao(valor, texto);
    if (nova.length !== valor.length) aoMudar(nova);
    setTexto(''); setEscrevendo(false);
  }

  return (
    <div className="campo">
      <label>Restrições médicas</label>
      <div className="tags-escolha">
        {TAGS_PADRAO.map((t) => (
          <button type="button" key={t} className={`chip ${valor.includes(t) ? 'on' : ''}`}
                  onClick={() => aoMudar(alternarRestricao(valor, t))}>
            {t}
          </button>
        ))}
        {proprias.map((r) => (
          <button type="button" key={r} className="chip on chip--propria" title="Clique para remover"
                  onClick={() => aoMudar(valor.filter((x) => x !== r))}>
            {r} <span aria-hidden="true">×</span>
          </button>
        ))}
        {!escrevendo && (
          <button type="button" className="chip chip--mais" disabled={cheio}
                  title={cheio ? `Máximo de ${LIMITE_RESTRICOES} restrições` : 'Escrever uma restrição que não está na lista'}
                  onClick={() => setEscrevendo(true)}>
            + outra
          </button>
        )}
      </div>

      {escrevendo && (
        <div className="restricao-nova">
          <input autoFocus value={texto} maxLength={40} placeholder="Ex.: bursite no ombro"
                 aria-label="Nova restrição médica"
                 onChange={(e) => setTexto(e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') { e.preventDefault(); acrescentar(); }
                   if (e.key === 'Escape') { e.preventDefault(); setTexto(''); setEscrevendo(false); }
                 }} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={acrescentar} disabled={!texto.trim()}>
            Acrescentar
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setTexto(''); setEscrevendo(false); }}>
            Cancelar
          </button>
        </div>
      )}

      {proprias.length > 0 && (
        <p className="form-nota">
          Restrição escrita à mão fica no cadastro e aparece para o professor, mas o sistema
          não consegue tirar exercício da ficha por ela. Para isso, marque também a tag da lista.
        </p>
      )}
    </div>
  );
}
