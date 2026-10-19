import { useEffect, useRef, useState } from 'react';

/**
 * Número que anda até o valor. Na primeira vez sobe do zero; depois, quando o
 * valor muda (um pagamento entrou, outro foi excluído), conta do valor antigo
 * até o novo -- é a tela mostrando o que acabou de mudar, em vez de o número
 * simplesmente trocar. Com "reduzir movimento" ligado, troca direto.
 */
export function Contagem({ valor, formatar, ms = 650 }: {
  valor: number;
  formatar: (n: number) => string;
  ms?: number;
}) {
  const [mostrado, setMostrado] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? valor : 0);
  const anterior = useRef<number | null>(null);

  useEffect(() => {
    const de = anterior.current ?? 0;
    anterior.current = valor;
    if (de === valor || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMostrado(valor);
      return;
    }
    const inicio = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const u = Math.min(1, Math.max(0, (agora - inicio) / ms));
      const suave = 1 - (1 - u) ** 3;              // desacelera no fim
      setMostrado(Math.round(de + (valor - de) * suave));
      if (u < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, ms]);

  return <>{formatar(mostrado)}</>;
}
