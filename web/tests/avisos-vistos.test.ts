import { describe, it, expect, beforeEach } from 'vitest';
import { chaveDoAviso, filtrarNaoVistos, marcarTodosComoVistos, limparVistosAntigos } from '../src/dominio/avisos-vistos';
import type { Aviso } from '../src/tipos';

function lojaFalsa(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
  } as Storage;
}

const aviso = (p: Partial<Aviso>): Aviso => ({
  tipo: 'vencido', gravidade: 'alta', titulo: 'Ana', detalhe: 'Plano vence amanhã', alunoId: 7, ...p,
});

let loja: Storage;
beforeEach(() => { loja = lojaFalsa(); });

describe('chaveDoAviso', () => {
  it('muda quando a situacao muda, para o aviso voltar', () => {
    const hoje = chaveDoAviso(aviso({ detalhe: 'Cobrança vencida há 1 dia' }));
    const amanha = chaveDoAviso(aviso({ detalhe: 'Cobrança vencida há 2 dias' }));
    expect(hoje).not.toBe(amanha);
  });

  it('o mesmo aviso do mesmo aluno da a mesma chave', () => {
    expect(chaveDoAviso(aviso({}))).toBe(chaveDoAviso(aviso({})));
  });

  it('alunos diferentes nunca compartilham chave', () => {
    expect(chaveDoAviso(aviso({ alunoId: 7 }))).not.toBe(chaveDoAviso(aviso({ alunoId: 8 })));
  });
});

describe('marcar como visto', () => {
  it('depois de marcar, o contador zera', () => {
    const lista = [aviso({ alunoId: 1 }), aviso({ alunoId: 2 })];
    expect(filtrarNaoVistos(lista, 9, loja)).toHaveLength(2);
    marcarTodosComoVistos(lista, 9, loja);
    expect(filtrarNaoVistos(lista, 9, loja)).toHaveLength(0);
  });

  it('aviso novo aparece mesmo depois de ter limpado os outros', () => {
    const antigos = [aviso({ alunoId: 1 })];
    marcarTodosComoVistos(antigos, 9, loja);
    const agora = [...antigos, aviso({ alunoId: 2, titulo: 'Bia' })];
    expect(filtrarNaoVistos(agora, 9, loja).map((a) => a.titulo)).toEqual(['Bia']);
  });

  it('a situacao mudou: o aviso volta mesmo tendo sido visto', () => {
    const ontem = [aviso({ detalhe: 'Cobrança vencida há 1 dia' })];
    marcarTodosComoVistos(ontem, 9, loja);
    const hoje = [aviso({ detalhe: 'Cobrança vencida há 2 dias' })];
    expect(filtrarNaoVistos(hoje, 9, loja)).toHaveLength(1);
  });

  it('cada pessoa tem a sua lista de vistos', () => {
    const lista = [aviso({})];
    marcarTodosComoVistos(lista, 9, loja);
    expect(filtrarNaoVistos(lista, 10, loja)).toHaveLength(1);
  });

  it('navegador sem armazenamento nao esconde aviso nenhum', () => {
    const ruim = { ...lojaFalsa(), setItem: () => { throw new Error('bloqueado'); } } as unknown as Storage;
    const lista = [aviso({})];
    expect(() => marcarTodosComoVistos(lista, 9, ruim)).not.toThrow();
    expect(filtrarNaoVistos(lista, 9, ruim)).toHaveLength(1);
  });
});

describe('limparVistosAntigos', () => {
  it('nao deixa a lista de vistos crescer para sempre', () => {
    const muitos = Array.from({ length: 400 }, (_, i) => aviso({ alunoId: i }));
    marcarTodosComoVistos(muitos, 9, loja);
    limparVistosAntigos(9, loja, 100);
    const guardadas = JSON.parse(loja.getItem('df-avisos-vistos:9')!);
    expect(guardadas.length).toBe(100);
    // mantem as ultimas, que sao as que ainda podem aparecer
    expect(filtrarNaoVistos(muitos.slice(-100), 9, loja)).toHaveLength(0);
  });
});
