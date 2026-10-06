import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconeFechar } from './Icones';
import './Modal.css';

/**
 * Folha inferior no celular, dialogo centralizado no PC. Esc e clique fora fecham.
 * Renderizado direto no <body> (portal): dentro de uma tela com animacao de
 * transform, position:fixed passa a se referir a tela, nao a janela, e o
 * modal abria fora da area visivel.
 */
export function Modal({ titulo, aoFechar, children, largo, ocultarTitulo }: {
  titulo: string; aoFechar: () => void; children: React.ReactNode; largo?: boolean;
  /** quando o conteudo ja mostra o titulo (ex.: perfil do aluno): so para leitor de tela */
  ocultarTitulo?: boolean;
}) {
  // fechar pelo usuario (Esc, fora, X) toca a saida antes de desmontar
  const [saindo, setSaindo] = useState(false);
  const fechandoRef = useRef(false);
  const fechar = useCallback(() => {
    if (fechandoRef.current) return;
    fechandoRef.current = true;
    setSaindo(true);
    window.setTimeout(aoFechar, 150);
  }, [aoFechar]);

  const caixaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { fechar(); return; }
      // Tab preso dentro do modal: sem isso o foco escapa para a tela de tras,
      // e quem usa teclado se perde no meio do cadastro.
      if (e.key !== 'Tab' || !caixaRef.current) return;
      const focaveis = caixaRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focaveis.length) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    };
    window.addEventListener('keydown', onKey);
    // trava a rolagem de tras: no app de PC quem rola e o #root, no navegador e o body
    document.documentElement.classList.add('modal-aberto');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('modal-aberto');
    };
  }, [fechar]);

  return createPortal(
    <div className={`modal-fundo ${saindo ? 'saindo' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div ref={caixaRef} className={`modal-caixa ${largo ? 'modal-caixa--largo' : ''}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-cab">
          <h3 className={ocultarTitulo ? 'so-leitor' : undefined}>{titulo}</h3>
          <button className="modal-x" onClick={fechar} aria-label="Fechar"><IconeFechar size={18} /></button>
        </div>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
