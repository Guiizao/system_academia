import { useEffect, useRef } from 'react';
import { IconeSeta } from './Icones';
import './Secao.css';

/**
 * Prévia de um assunto da tela: o essencial e um botão para o painel completo.
 * Cada tela abre mostrando um pouco de cada coisa, sem repetir o que outra
 * prévia já mostra; o detalhe fica a um clique, em "Ver tudo".
 */
export function Secao({ titulo, resumo, alerta, verTudo, children, className = '' }: {
  titulo: React.ReactNode;
  resumo?: React.ReactNode;
  /** destaque curto em vermelho (ex.: "3 vencidas") */
  alerta?: string;
  verTudo?: { rotulo: string; aoClicar: () => void };
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`secao ${className}`}>
      <header className="secao__cab">
        <div className="secao__id">
          <h3>{titulo}</h3>
          {(resumo || alerta) && (
            <p>{resumo}{alerta && <span className="secao__alerta">{alerta}</span>}</p>
          )}
        </div>
        {verTudo && (
          <button type="button" className="secao__ver" onClick={verTudo.aoClicar}>
            {verTudo.rotulo}<IconeSeta size={15} />
          </button>
        )}
      </header>
      {children && <div className="secao__corpo">{children}</div>}
    </section>
  );
}

/**
 * O painel completo aberto a partir de uma prévia. Mostra de onde veio e volta
 * para lá pelo botão ou pelo Esc -- o mesmo gesto de fechar uma janela.
 */
export function SubTela({ origem, titulo, sub, acoes, aoVoltar, children }: {
  origem: string;
  titulo: React.ReactNode;
  sub?: React.ReactNode;
  acoes?: React.ReactNode;
  aoVoltar: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      // com uma janela aberta por cima o Esc é dela; dentro de um campo, é do
      // campo (limpa a busca) -- voltar ali jogaria fora os filtros
      const campo = (e.target as HTMLElement | null)?.closest?.('input, select, textarea');
      if (e.key === 'Escape' && !campo && !document.querySelector('.modal-caixa')) aoVoltar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoVoltar]);

  // o botão que abriu o painel some da tela: o foco vem para o "voltar", e não cai no nada
  const voltarRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { voltarRef.current?.focus({ preventScroll: true }); }, []);

  return (
    <>
      <div className="sec-head subtela__cab">
        <div className="subtela__id">
          <button type="button" className="subtela__voltar" onClick={aoVoltar} ref={voltarRef}>
            <IconeSeta size={15} />{origem}
          </button>
          <h2>{titulo}</h2>
          {sub && <p className="sec-sub">{sub}</p>}
        </div>
        {acoes && <div className="sec-head__acoes">{acoes}</div>}
      </div>
      {children}
    </>
  );
}
