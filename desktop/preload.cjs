// Ponte minima e explicita entre o painel e o processo principal.
// O painel nao tem acesso ao Node: so a estas funcoes.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('df', {
  estado: () => ipcRenderer.invoke('estado'),
  logs: () => ipcRenderer.invoke('logs'),
  iniciar: () => ipcRenderer.invoke('iniciar'),
  parar: () => ipcRenderer.invoke('parar'),
  abrirSistema: () => ipcRenderer.invoke('abrir-sistema'),
  backup: () => ipcRenderer.invoke('backup'),
  abrirPasta: (qual) => ipcRenderer.invoke('abrir-pasta', qual),
  qr: (url) => ipcRenderer.invoke('qr', url),
  // colocar o sistema na internet (tunel da Cloudflare)
  abrirTunel: () => ipcRenderer.invoke('tunel:abrir'),
  fecharTunel: () => ipcRenderer.invoke('tunel:fechar'),
  iniciarComWindows: (ligado) => ipcRenderer.invoke('iniciar-com-windows', ligado),
  primeiroAcesso: (dados) => ipcRenderer.invoke('primeiro-acesso', dados),
  dadosDemo: () => ipcRenderer.invoke('dados-demo'),
  resetarDados: (confirmacao) => ipcRenderer.invoke('resetar-dados', confirmacao),
  aoMudarEstado: (fn) => ipcRenderer.on('estado', (_e, s) => fn(s)),
  aoLog: (fn) => ipcRenderer.on('log', (_e, l) => fn(l)),
  // botoes da barra de titulo (a janela nao tem a moldura do Windows)
  janela: {
    minimizar: () => ipcRenderer.send('janela:minimizar'),
    maximizar: () => ipcRenderer.send('janela:maximizar'),
    fechar: () => ipcRenderer.send('janela:fechar'),
    maximizada: () => ipcRenderer.invoke('janela:maximizada'),
    aoMudar: (fn) => ipcRenderer.on('janela:maximizada', (_e, v) => fn(v)),
  },
});
