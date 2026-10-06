import { useCallback, useEffect, useState } from 'react';
import { formatarBRL } from '../dominio';
import { alternarValores, ouvirValores, valoresVisiveis } from '../valores';

/**
 * O olhinho que esconde o dinheiro, e o formatador que obedece a ele.
 *
 * A máscara tem o mesmo "R$" do valor de verdade e largura parecida, para a
 * tela não pular quando a pessoa liga e desliga.
 */
export const DINHEIRO_ESCONDIDO = 'R$ ••••';

/** Formata respeitando o olho. Use no lugar de `formatarBRL` em tela com dinheiro. */
export function useValores() {
  const [visivel, setVisivel] = useState(valoresVisiveis);
  // todas as telas ouvem a mesma chave: clicar num olho mexe em todos
  useEffect(() => ouvirValores(setVisivel), []);
  const formatar = useCallback(
    (centavos: number) => (visivel ? formatarBRL(centavos) : DINHEIRO_ESCONDIDO),
    [visivel],
  );
  return { visivel, formatar, alternar: alternarValores };
}

function IconeOlho({ aberto }: { aberto: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.8 10S4.9 4.6 10 4.6 18.2 10 18.2 10 15.1 15.4 10 15.4 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.6" />
      {/* risco atravessado só quando está escondido */}
      {!aberto && <path d="M3.4 3.4 16.6 16.6" />}
    </svg>
  );
}

/** Botão de esconder/mostrar. A mesma escolha vale para o sistema inteiro. */
export function Olho({ className = '' }: { className?: string }) {
  const { visivel, alternar } = useValores();
  const rotulo = visivel ? 'Esconder os valores' : 'Mostrar os valores';
  return (
    <button type="button" className={`olho ${className}`} onClick={alternar}
            title={`${rotulo} (vale para todas as telas, só neste aparelho)`}
            aria-label={rotulo} aria-pressed={!visivel}>
      <IconeOlho aberto={visivel} />
    </button>
  );
}
