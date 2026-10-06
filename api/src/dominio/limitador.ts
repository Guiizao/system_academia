/**
 * Limitador de tentativas por janela deslizante.
 *
 * Existe para segurar duas coisas que o bloqueio por e-mail nao segura:
 *  - varrer senhas trocando o e-mail a cada tentativa (nunca bloqueia por e-mail);
 *  - derrubar o notebook da academia so pelo custo do argon2, que e caro de
 *    proposito -- dezenas de chamadas por segundo bastam, sem acertar senha nenhuma.
 *
 * Fica em memoria: reinicia junto com o servidor, o que e aceitavel porque o
 * ataque tambem recomeca do zero. Sem tabela, sem escrita em disco no caminho
 * de quem nem se autenticou.
 */

export interface Limite {
  /** quantas tentativas cabem na janela */
  max: number;
  janelaMs: number;
}

export interface Veredito {
  ok: boolean;
  /** quanto falta para abrir uma vaga; 0 quando passou */
  esperarSeg: number;
}

export function criarLimitador({ max, janelaMs }: Limite) {
  if (!Number.isInteger(max) || max < 1) throw new Error('limitador: max precisa ser inteiro positivo');
  if (!Number.isInteger(janelaMs) || janelaMs < 1) throw new Error('limitador: janelaMs precisa ser inteiro positivo');

  /** chave -> horarios das tentativas que ainda estao na janela, em ordem */
  const registros = new Map<string, number[]>();
  let proximaLimpeza = 0;

  /** varre o mapa inteiro de vez em quando: sem isso cada IP novo fica guardado para sempre */
  function limpar(agora: number) {
    if (agora < proximaLimpeza) return;
    proximaLimpeza = agora + janelaMs;
    for (const [chave, marcas] of registros) {
      if (!marcas.length || marcas[marcas.length - 1] <= agora - janelaMs) registros.delete(chave);
    }
  }

  function tentar(chave: string, agora: number = Date.now()): Veredito {
    limpar(agora);
    const corte = agora - janelaMs;
    const marcas = (registros.get(chave) ?? []).filter((t) => t > corte);

    if (marcas.length >= max) {
      // a vaga mais proxima abre quando a tentativa mais antiga sair da janela.
      // A recusa NAO entra na lista: senao quem insiste empurraria a propria
      // janela e ficaria preso mesmo depois de parar.
      registros.set(chave, marcas);
      const esperaMs = marcas[0] + janelaMs - agora;
      return { ok: false, esperarSeg: Math.max(1, Math.ceil(esperaMs / 1000)) };
    }

    marcas.push(agora);
    registros.set(chave, marcas);
    return { ok: true, esperarSeg: 0 };
  }

  /** limpa a contagem de uma chave -- usado quando o login da certo */
  function esquecer(chave: string) {
    registros.delete(chave);
  }

  /** quantas chaves estao guardadas; serve para o teste provar que nao cresce sem fim */
  function tamanho() {
    return registros.size;
  }

  return { tentar, esquecer, tamanho };
}

export type Limitador = ReturnType<typeof criarLimitador>;
