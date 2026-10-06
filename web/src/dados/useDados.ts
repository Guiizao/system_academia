import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Carrega dados assincronos com estados de carregando/erro e um recarregar().
 * Ignora respostas que chegam depois de o componente mudar de dependencia --
 * senao a busca antiga sobrescreveria a nova.
 */
export function useDados<T>(carregar: () => Promise<T>, deps: unknown[] = [], opts: { aCadaMs?: number } = {}) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const geracao = useRef(0);

  // silencioso: atualizacao em segundo plano nao troca a tela por "Carregando…"
  const executar = useCallback((silencioso = false) => {
    const minha = ++geracao.current;
    if (!silencioso) setCarregando(true);
    carregar()
      .then((d) => { if (minha === geracao.current) { setDados(d); setErro(null); } })
      .catch((e) => { if (minha === geracao.current) setErro(e.message); })
      .finally(() => { if (minha === geracao.current) setCarregando(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { executar(); }, [executar]);

  // telas "ao vivo": o que outro aparelho registrou aparece sem ninguem recarregar.
  // Aba escondida nao consulta; ao voltar para ela, atualiza na hora.
  const { aCadaMs } = opts;
  useEffect(() => {
    if (!aCadaMs) return;
    const tick = () => { if (document.visibilityState === 'visible') executar(true); };
    const id = setInterval(tick, aCadaMs);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [aCadaMs, executar]);

  const recarregar = useCallback(() => executar(), [executar]);
  return { dados, erro, carregando, recarregar };
}
