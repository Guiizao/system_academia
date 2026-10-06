import { createContext, useContext } from 'react';
import type { Usuario } from './tipos';

interface Sessao {
  usuario: Usuario;
  sair: () => void;
  avisar: (msg: string, tom?: 'ok' | 'erro' | 'info') => void;
}

export const SessaoCtx = createContext<Sessao | null>(null);

export function useSessao(): Sessao {
  const s = useContext(SessaoCtx);
  if (!s) throw new Error('useSessao fora do SessaoCtx');
  return s;
}

/** Espelho, na tela, da matriz do servidor (spec 5.6). So UX: quem decide e a API. */
export const pode = {
  verFinanceiro: (u: Usuario) => u.papel === 'dono',
  receberPagamento: (u: Usuario) => u.papel === 'dono' || u.papel === 'recepcao',
  liberarFicha: (u: Usuario) => u.papel !== 'recepcao',
  editarPlanos: (u: Usuario) => u.papel === 'dono',
};
