/** Sessao expirou ou nao existe: a App volta para a tela de login. */
export class ErroSessao extends Error {
  constructor() { super('Sessão expirada. Entre de novo.'); }
}

let aoPerderSessao: () => void = () => {};
export function quandoPerderSessao(fn: () => void) { aoPerderSessao = fn; }

/** Uma porta so para a API: trata erro de sessao e mensagem legivel do servidor. */
export async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (r.status === 401 && !url.endsWith('/auth/login')) {
    aoPerderSessao();
    throw new ErroSessao();
  }
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((dados as any).erro ?? `Erro ${r.status}`);
  return dados as T;
}

export const get = <T>(url: string) => req<T>('GET', url);
export const post = <T>(url: string, body?: unknown) => req<T>('POST', url, body ?? {});
export const put = <T>(url: string, body: unknown) => req<T>('PUT', url, body);
export const del = <T>(url: string) => req<T>('DELETE', url);
