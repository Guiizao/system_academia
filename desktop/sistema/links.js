/**
 * Link que a pagina do sistema pede para abrir fora do app (WhatsApp, site).
 * So http e https: shell.openExternal com file: ou outro protocolo executaria
 * programas do PC a partir de um texto que veio da rede.
 */
export function linkExternoPermitido(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * E a propria pagina do sistema? Comparar o inicio do endereco nao serve:
 * "http://localhost:3000@evil.example" comeca igual e o site de verdade e
 * outro -- dentro da janela sem moldura passaria por tela de login.
 */
export function ehOSistema(url, porta) {
  try {
    return new URL(url).origin === `http://localhost:${porta}`;
  } catch {
    return false;
  }
}
