// Ponte da janela do SISTEMA (a pagina web servida pelo proprio app).
// Expoe so os botoes da barra de titulo -- a pagina continua sem acesso ao
// Node e a qualquer outra funcao do app. No navegador comum (celular, outro
// PC) esta ponte nao existe, e a pagina nao desenha barra nenhuma.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dfJanela', {
  minimizar: () => ipcRenderer.send('janela:minimizar'),
  maximizar: () => ipcRenderer.send('janela:maximizar'),
  fechar: () => ipcRenderer.send('janela:fechar'),
  maximizada: () => ipcRenderer.invoke('janela:maximizada'),
  // devolve a funcao que desliga o aviso (a tela pode montar de novo)
  aoMudar: (fn) => {
    const ouvinte = (_e, v) => fn(v);
    ipcRenderer.on('janela:maximizada', ouvinte);
    return () => ipcRenderer.removeListener('janela:maximizada', ouvinte);
  },
});
