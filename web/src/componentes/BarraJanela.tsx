import { useEffect, useState } from 'react';
import './BarraJanela.css';

/** Ponte que o app de PC injeta (desktop/preload-sistema.cjs). No navegador, nao existe. */
type PonteJanela = {
  minimizar: () => void; maximizar: () => void; fechar: () => void;
  maximizada: () => Promise<boolean>; aoMudar: (fn: (sim: boolean) => void) => () => void;
};
declare global { interface Window { dfJanela?: PonteJanela } }

export const noAppDePc = typeof window !== 'undefined' && !!window.dfJanela;

/**
 * Barra de titulo do app de PC, na cor do sistema (segue o tema claro/escuro).
 * Arrasta pela barra, duplo clique maximiza. Fechar so fecha a janela: o
 * servidor segue ligado na bandeja.
 */
export function BarraJanela() {
  const ponte = window.dfJanela;
  const [maximizada, setMaximizada] = useState(false);

  useEffect(() => {
    if (!ponte) return;
    ponte.maximizada().then(setMaximizada);
    return ponte.aoMudar(setMaximizada);
  }, [ponte]);

  if (!ponte) return null;
  const rotuloMax = maximizada ? 'Restaurar' : 'Tela cheia';
  return (
    <header className="barra-janela">
      <span className="barra-janela__titulo">DARK <b>FISIC</b></span>
      <div className="barra-janela__botoes">
        <button className="jbtn jbtn--min" onClick={ponte.minimizar} title="Minimizar" aria-label="Minimizar">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8" /></svg>
        </button>
        <button className="jbtn jbtn--max" onClick={ponte.maximizar} title={rotuloMax} aria-label={rotuloMax}>
          {maximizada
            ? <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.2 3.6V3a1 1 0 0 1 1-1H9a1 1 0 0 1 1 1v3.8a1 1 0 0 1-1 1h-.6" /><rect x="2" y="4.2" width="6" height="5.8" rx="1.2" /></svg>
            : <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1.5" /></svg>}
        </button>
        <button className="jbtn jbtn--fechar" onClick={ponte.fechar} title="Fechar (o sistema continua ligado na bandeja)" aria-label="Fechar">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" /></svg>
        </button>
      </div>
    </header>
  );
}
