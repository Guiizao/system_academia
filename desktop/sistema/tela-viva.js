const ESPERA_ENTRE_RECARGAS = 10_000;

/**
 * As janelas nao tem moldura do Windows: o X e desenhado pela pagina. Se o
 * processo da pagina morre ou trava, sobra so o fundo escuro, sem botao que
 * funcione (a "tela preta" que o Joao relatou). Aqui a pagina volta sozinha.
 */
export function manterTelaViva(janela, nome, log, agora = Date.now) {
  const tela = janela.webContents;
  let ultima = -Infinity;
  tela.on('render-process-gone', (_e, { reason }) => {
    if (reason === 'clean-exit' || janela.isDestroyed()) return;
    // pagina que cai logo ao abrir nao pode virar recarga sem fim
    if (agora() - ultima < ESPERA_ENTRE_RECARGAS) { log(`${nome}: a tela caiu de novo (${reason}). Não recarreguei.`, 'erro'); return; }
    ultima = agora();
    log(`${nome}: a tela caiu (${reason}). Recarregando.`, 'erro');
    tela.reload();
  });
  // matar a pagina travada dispara o render-process-gone acima, que recarrega
  tela.on('unresponsive', () => {
    if (janela.isDestroyed()) return;
    log(`${nome}: a tela travou. Reiniciando.`, 'erro');
    tela.forcefullyCrashRenderer();
  });
}
