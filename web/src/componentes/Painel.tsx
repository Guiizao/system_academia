import { useState } from 'react';
import './Painel.css';

/**
 * Lista que comeca fechada, mostrando so o resumo.
 *
 * Antes a tela abria com todas as listas abertas e virava um rolo sem fim --
 * para ver o de baixo era preciso passar por dezenas de nomes. Agora a tela
 * cabe, e quem precisa da lista abre.
 */
export function Painel({ titulo, resumo, alerta, quantidade, children, abertoInicial = false }: {
  titulo: string;
  resumo: string;
  /** destaque curto em vermelho (ex.: "3 vencidas") */
  alerta?: string;
  quantidade: number;
  children: React.ReactNode;
  abertoInicial?: boolean;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  const vazio = quantidade === 0;

  return (
    <section className={`previa ${aberto ? 'previa--aberto' : ''}`}>
      <div className="previa__cab">
        <div className="previa__id">
          <h3>{titulo}</h3>
          <p>
            {resumo}
            {alerta && <span className="previa__alerta">{alerta}</span>}
          </p>
        </div>
        {!vazio && (
          <button type="button" className="btn btn-secondary btn-sm" aria-expanded={aberto}
                  onClick={() => setAberto((a) => !a)}>
            {aberto ? 'Fechar lista' : 'Abrir lista'}
          </button>
        )}
      </div>
      {aberto && !vazio && <div className="previa__corpo escalonar">{children}</div>}
    </section>
  );
}
