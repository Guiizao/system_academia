import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { manterTelaViva } from '../sistema/tela-viva.js';

function cenario() {
  const tela = Object.assign(new EventEmitter(), { recargas: 0, mortes: 0, reload() { this.recargas++; }, forcefullyCrashRenderer() { this.mortes++; } });
  const c = { tela, destruida: false, relogio: 1_000_000, logs: [] };
  manterTelaViva({ webContents: tela, isDestroyed: () => c.destruida }, 'Painel', (m) => c.logs.push(m), () => c.relogio);
  return c;
}

test('pagina que caiu volta sozinha e fica no log', () => {
  const c = cenario();
  c.tela.emit('render-process-gone', {}, { reason: 'oom' });
  assert.equal(c.tela.recargas, 1);
  assert.match(c.logs[0], /Painel.*oom/);
});

test('saida normal e janela ja fechada nao recarregam', () => {
  const c = cenario();
  c.tela.emit('render-process-gone', {}, { reason: 'clean-exit' });
  c.destruida = true;
  c.tela.emit('render-process-gone', {}, { reason: 'crashed' });
  assert.equal(c.tela.recargas, 0);
});

test('pagina que cai em seguida nao vira recarga sem fim', () => {
  const c = cenario();
  c.tela.emit('render-process-gone', {}, { reason: 'crashed' });
  c.relogio += 2_000;
  c.tela.emit('render-process-gone', {}, { reason: 'crashed' });
  assert.equal(c.tela.recargas, 1);
  c.relogio += 11_000;
  c.tela.emit('render-process-gone', {}, { reason: 'crashed' });
  assert.equal(c.tela.recargas, 2);
});

test('pagina travada e reiniciada', () => {
  const c = cenario();
  c.tela.emit('unresponsive');
  assert.equal(c.tela.mortes, 1);
});
