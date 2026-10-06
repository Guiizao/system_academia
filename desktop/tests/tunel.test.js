import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { criarTunel, enderecoDaLinha, ONDE_PROCURAR, SEM_PROGRAMA } from '../sistema/tunel.js';

/** O que o cloudflared escreve de verdade quando o tunel sobe. */
const SAIDA_REAL = [
  '2026-10-06T21:40:02Z INF Thank you for trying Cloudflare Tunnel.',
  '2026-10-06T21:40:04Z INF +--------------------------------------------------------------------------+',
  '2026-10-06T21:40:04Z INF |  Your quick Tunnel has been created! Visit it at:                         |',
  '2026-10-06T21:40:04Z INF |  https://jeans-polyphonic-marina-tracked.trycloudflare.com                |',
  '2026-10-06T21:40:04Z INF +--------------------------------------------------------------------------+',
].join('\n');

const ENDERECO = 'https://jeans-polyphonic-marina-tracked.trycloudflare.com';

/** Um cloudflared de mentira: emite o que mandarem e anota como foi chamado. */
function cloudflaredFalso({ falhaEm = [], saida = SAIDA_REAL, nuncaResponde = false } = {}) {
  const chamadas = [];
  let ultimo = null;
  const spawn = (caminho, args, opcoes) => {
    chamadas.push({ caminho, args, opcoes });
    const filho = new EventEmitter();
    filho.stdout = new EventEmitter();
    filho.stderr = new EventEmitter();
    filho.morto = false;
    filho.kill = () => { filho.morto = true; };
    ultimo = filho;
    queueMicrotask(() => {
      if (falhaEm.includes(caminho)) {
        const e = new Error(`spawn ${caminho} ENOENT`);
        e.code = 'ENOENT';
        filho.emit('error', e);
      } else if (!nuncaResponde) {
        // o endereco sai pelo stderr, como no programa de verdade
        filho.stderr.emit('data', Buffer.from(saida));
      }
    });
    return filho;
  };
  return { spawn, chamadas, filho: () => ultimo };
}

test('acha o endereco no meio da moldura que o cloudflared desenha', () => {
  const linha = '2026-10-06T21:40:04Z INF |  https://jeans-polyphonic-marina-tracked.trycloudflare.com  |';
  assert.equal(enderecoDaLinha(linha), ENDERECO);
});

test('linha sem endereco nao inventa nada', () => {
  assert.equal(enderecoDaLinha('2026-10-06 INF Thank you for trying Cloudflare Tunnel.'), null);
  assert.equal(enderecoDaLinha(''), null);
  assert.equal(enderecoDaLinha(null), null);
  // endereco de outro dominio nao serve
  assert.equal(enderecoDaLinha('https://darkfisic.com.br'), null);
});

test('liga e devolve o endereco, apontando para a porta certa', async () => {
  const falso = cloudflaredFalso();
  const tunel = criarTunel({ spawn: falso.spawn });
  assert.equal(tunel.estado().estado, 'desligado');

  const r = await tunel.abrir(3000);
  assert.equal(r.estado, 'no-ar');
  assert.equal(r.url, ENDERECO);
  assert.deepEqual(falso.chamadas[0].args, ['tunnel', '--url', 'http://localhost:3000']);
});

test('se o primeiro caminho nao tem o programa, tenta o proximo', async () => {
  // winget nao instalou (o nome puro falha), mas o .exe esta em C:\cloudflared
  const falso = cloudflaredFalso({ falhaEm: ['cloudflared'] });
  const tunel = criarTunel({ spawn: falso.spawn });

  const r = await tunel.abrir(3000);
  assert.equal(r.estado, 'no-ar');
  assert.equal(falso.chamadas.length, 2);
  assert.equal(falso.chamadas[1].caminho, ONDE_PROCURAR[1]);
});

test('sem o programa em lugar nenhum, explica como instalar', async () => {
  const falso = cloudflaredFalso({ falhaEm: ONDE_PROCURAR });
  const tunel = criarTunel({ spawn: falso.spawn });

  const r = await tunel.abrir(3000);
  assert.equal(r.estado, 'sem-programa');
  assert.equal(r.url, null);
  assert.match(r.erro, /winget install/);
  assert.equal(r.erro, SEM_PROGRAMA);
});

test('se o cloudflared nao responde, desiste em vez de ficar pendurado', async () => {
  const falso = cloudflaredFalso({ nuncaResponde: true });
  const tunel = criarTunel({ spawn: falso.spawn, esperaMs: 20 });

  const r = await tunel.abrir(3000);
  assert.equal(r.estado, 'erro');
  assert.match(r.erro, /não respondeu/);
  assert.equal(falso.filho().morto, true, 'o processo pendurado tem de ser encerrado');
});

test('desligar mata o processo e volta para desligado', async () => {
  const falso = cloudflaredFalso();
  const tunel = criarTunel({ spawn: falso.spawn });
  await tunel.abrir(3000);

  const r = tunel.fechar();
  assert.equal(r.estado, 'desligado');
  assert.equal(r.url, null);
  assert.equal(falso.filho().morto, true);
});

test('ligar duas vezes nao abre dois tuneis', async () => {
  const falso = cloudflaredFalso();
  const tunel = criarTunel({ spawn: falso.spawn });
  await tunel.abrir(3000);
  await tunel.abrir(3000);
  assert.equal(falso.chamadas.length, 1);
});

test('se a ligacao cair depois de no ar, o painel fica sabendo', async () => {
  const falso = cloudflaredFalso();
  const tunel = criarTunel({ spawn: falso.spawn });
  await tunel.abrir(3000);
  assert.equal(tunel.estado().estado, 'no-ar');

  falso.filho().emit('exit', 1);
  await new Promise((pronto) => setImmediate(pronto));

  assert.equal(tunel.estado().estado, 'erro');
  assert.match(tunel.estado().erro, /caiu/);
});
