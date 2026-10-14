import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Executa os handlers reais, substituindo apenas Electron, disco, relógio e módulos empacotados.
function carregarPrincipal({ falhasBackup = 0 } = {}) {
  const handlers = new Map(), eventos = new Map(), intervalos = new Map();
  const removidos = [];
  let backups = 0, fechamentosTunel = 0;
  const instancia = { urls: [], db: {}, sqlite: {}, parar: async () => {} };
  const codigo = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?$/gm, '')
    .replace(/const importar = .*;/, 'const importar = carregarModulo;')
    .replaceAll('import.meta.url', JSON.stringify(new URL('../main.js', import.meta.url).href));
  const contexto = {
    app: {
      getAppPath: () => 'C:/teste/app', getPath: () => 'C:/teste', getVersion: () => 'teste',
      setPath() {}, setAppUserModelId() {}, requestSingleInstanceLock: () => true,
      on: (nome, funcao) => eventos.set(nome, funcao), whenReady: () => ({ then() {} }), quit() {},
    },
    ipcMain: { on() {}, handle: (nome, funcao) => handlers.set(nome, funcao) },
    join, dirname, fileURLToPath, pathToFileURL,
    mkdirSync() {}, appendFileSync() {}, existsSync: () => true,
    rmSync: (caminho) => removidos.push(caminho),
    process: { env: { DF_DADOS: 'C:/teste/dados' }, argv: [] },
    setInterval: (funcao, prazo) => intervalos.set(prazo, funcao),
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-14T12:00:00-03:00'])); } },
    spawn() {}, criarTunel: () => ({ estado: () => ({}), fechar: () => { fechamentosTunel++; } }),
    carregarModulo: async (caminho) => {
      if (caminho === 'index.js') return { iniciar: async () => instancia, ipsLocais: () => [] };
      if (caminho === 'servicos/importacao.js') return { importarDaPasta: () => [] };
      if (caminho === 'servicos/primeiro-acesso.js') return { precisaConfigurar: () => false };
      if (caminho === 'servicos/backup.js') return {
        fazerBackup: () => { backups++; if (backups <= falhasBackup) throw new Error('disco indisponível'); return 'copia.db'; },
        aplicarRetencao: () => [], listarBackups: () => [],
      };
      throw new Error(`Módulo inesperado: ${caminho}`);
    },
  };
  runInNewContext(codigo, contexto, { filename: 'main.js' });
  return { handlers, eventos, intervalos, removidos, backups: () => backups, fechamentosTunel: () => fechamentosTunel };
}

test('reset com servidor parado recusa apagar dados sem backup', async () => {
  const principal = carregarPrincipal();
  await assert.rejects(principal.handlers.get('resetar-dados')(null, 'APAGAR TUDO'), /Inicie o servidor/);
  assert.equal(principal.removidos.length, 0);
});

test('backup automático que falhou é tentado novamente no mesmo dia', async () => {
  const principal = carregarPrincipal({ falhasBackup: 1 });
  await principal.handlers.get('iniciar')();
  const verificar = principal.intervalos.get(10 * 60 * 1000);
  await verificar();
  await verificar();
  await verificar();
  assert.equal(principal.backups(), 2);
});

test('encerrar o aplicativo fecha o túnel mesmo com servidor parado', async () => {
  const principal = carregarPrincipal();
  await principal.eventos.get('before-quit')({ preventDefault() {} });
  assert.equal(principal.fechamentosTunel(), 1);
});
