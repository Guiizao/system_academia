import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerInicioWindows, gravarInicioWindows } from '../sistema/inicio-windows.js';
import { linkExternoPermitido, ehOSistema } from '../sistema/links.js';
import { mensagemImportacao } from '../sistema/importacao.js';

/** Igual ao Windows: so responde "ligado" para quem pergunta com os MESMOS argumentos. */
function appFalso() {
  let gravado = null;
  return {
    setLoginItemSettings: (s) => { gravado = s; },
    getLoginItemSettings: (consulta = {}) => ({
      openAtLogin: !!gravado?.openAtLogin && JSON.stringify(gravado.args ?? []) === JSON.stringify(consulta.args ?? []),
    }),
  };
}

test('iniciar com o Windows continua ligado depois de gravar e ler de novo', () => {
  const app = appFalso();
  assert.equal(gravarInicioWindows(app, true), true);
  assert.equal(lerInicioWindows(app), true);
  assert.equal(lerInicioWindows(app), true);
});

test('desligar grava desligado', () => {
  const app = appFalso();
  gravarInicioWindows(app, true);
  assert.equal(gravarInicioWindows(app, false), false);
  assert.equal(lerInicioWindows(app), false);
});

test('link externo: so http e https', () => {
  assert.equal(linkExternoPermitido('https://wa.me/5514999999999?text=oi'), true);
  assert.equal(linkExternoPermitido('http://exemplo.com'), true);
  assert.equal(linkExternoPermitido('file:///C:/Windows/System32/cmd.exe'), false);
  assert.equal(linkExternoPermitido('javascript:alert(1)'), false);
  assert.equal(linkExternoPermitido('nao e link'), false);
});

test('so o proprio sistema abre dentro da janela', () => {
  assert.equal(ehOSistema('http://localhost:3000/alunos', 3000), true);
  assert.equal(ehOSistema('http://localhost:3000', 3000), true);
  // o '@' faz o endereco de verdade ser evil.example: parecia o sistema no startsWith
  assert.equal(ehOSistema('http://localhost:3000@evil.example/login', 3000), false);
  assert.equal(ehOSistema('http://localhost:30001/x', 3000), false);
  assert.equal(ehOSistema('https://localhost:3000/x', 3000), false);
  assert.equal(ehOSistema('file:///C:/Windows/System32/cmd.exe', 3000), false);
  assert.equal(ehOSistema('nao e link', 3000), false);
});

test('mensagem da importacao conta o que entrou e o que foi pulado', () => {
  const msg = mensagemImportacao({
    arquivo: 'alunos.json', situacao: 'importado', backup: 'C:\\x\\backups\\antes-da-importacao-2026.db',
    resumo: { alunosCriados: 111, planosCriados: 5, matriculas: 110, pagamentos: 120, ignorados: ['Ana'] },
  });
  assert.match(msg, /111 alunos/);
  assert.match(msg, /110 matrículas/);
  assert.match(msg, /120 pagamentos/);
  assert.match(msg, /1 já estava cadastrado/);
  assert.match(msg, /antes-da-importacao-2026\.db/);
});

test('mensagem da importacao explica erro e espera', () => {
  assert.match(mensagemImportacao({ arquivo: 'a.json', situacao: 'erro', motivo: 'JSON quebrado' }), /a\.json.*JSON quebrado/);
  assert.match(mensagemImportacao({ arquivo: 'a.json', situacao: 'aguardando', motivo: 'Crie a conta' }), /Crie a conta/);
});
