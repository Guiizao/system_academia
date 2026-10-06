/**
 * Iniciar com o Windows: grava e LE com os mesmos argumentos. No Windows a
 * leitura compara os argumentos -- ler sem o '--oculto' devolvia "desligado"
 * e o painel desmarcava a opcao sozinho a cada atualizacao.
 */
const INICIO_WINDOWS = Object.freeze({ args: Object.freeze(['--oculto']) });

/** @param {Pick<Electron.App, 'getLoginItemSettings'>} app */
export function lerInicioWindows(app) {
  return app.getLoginItemSettings({ args: [...INICIO_WINDOWS.args] }).openAtLogin;
}

/** @param {Pick<Electron.App, 'getLoginItemSettings' | 'setLoginItemSettings'>} app */
export function gravarInicioWindows(app, ligado) {
  app.setLoginItemSettings({ openAtLogin: !!ligado, args: [...INICIO_WINDOWS.args] });
  return lerInicioWindows(app);
}
