/**
 * Colocar o sistema na internet, pelo botão do painel.
 *
 * Quem faz o trabalho é o `cloudflared`, o mesmo programa do guia: ele abre
 * uma ligação de saída do notebook até a Cloudflare e devolve um endereço
 * `https://...trycloudflare.com` que aponta de volta para cá. Não abre porta
 * no roteador e não precisa de IP fixo.
 *
 * Aqui dentro só tem: achar o programa, ligar, LER O ENDEREÇO que ele imprime
 * e desligar. A leitura do endereço é função pura, testada com a saída real
 * que o cloudflared escreve.
 *
 * Importante sobre o que isso significa: enquanto o túnel está no ar, a tela
 * de login do sistema fica acessível da internet para quem tiver o endereço.
 * O endereço é aleatório e muda a cada vez, mas não é segredo — a conta e a
 * senha é que seguram a porta. Por isso o painel pede um clique explícito e
 * mostra um aviso, em vez de ligar sozinho.
 */

/** O endereço que o cloudflared imprime quando o túnel sobe. */
const ENDERECO = /https:\/\/[a-z0-9][a-z0-9-]*\.trycloudflare\.com/i;

/**
 * Acha o endereço numa linha da saída do cloudflared.
 *
 * Ele imprime o endereço dentro de uma moldura de caracteres e com texto em
 * volta, em mais de um formato conforme a versão -- por isso a busca é por
 * padrão, e não por posição ou por prefixo de linha.
 */
export function enderecoDaLinha(linha) {
  const achado = String(linha ?? '').match(ENDERECO);
  return achado ? achado[0] : null;
}

/**
 * Onde procurar o programa, em ordem. O primeiro é o nome puro: vale quando
 * o `winget` instalou e o PATH já conhece. Os outros são os lugares que o
 * guia manda usar quando a pessoa baixou o .exe na mão.
 */
export const ONDE_PROCURAR = [
  'cloudflared',
  'C:\\cloudflared\\cloudflared.exe',
  'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
  'C:\\Program Files\\cloudflared\\cloudflared.exe',
];

/** Quanto esperar o endereço aparecer antes de desistir. */
export const ESPERA_MS = 30_000;

export const SEM_PROGRAMA =
  'O programa cloudflared não está instalado neste computador. '
  + 'Abra o PowerShell como administrador e rode: winget install --id Cloudflare.cloudflared';

/**
 * O túnel, com as dependências injetadas para dar para testar sem internet
 * e sem o programa instalado.
 *
 * @param {{ spawn: Function, log?: Function, esperaMs?: number, onde?: string[] }} deps
 */
export function criarTunel({ spawn, log = () => {}, esperaMs = ESPERA_MS, onde = ONDE_PROCURAR }) {
  let processo = null;
  let atual = { estado: 'desligado', url: null, erro: null };
  let abertura = null, cancelarTentativa = null;
  let geracao = 0;

  const estado = () => ({ ...atual });

  function encerrarProcesso() {
    if (!processo) return;
    const p = processo;
    processo = null;
    try { p.kill(); } catch { /* já morreu */ }
  }

  /**
   * Liga o túnel e só resolve quando o endereço aparecer. Tenta os caminhos em
   * ordem: "programa não encontrado" num deles não é erro, é o próximo da fila.
   */
  function abrir(porta) {
    if (atual.estado === 'no-ar') return Promise.resolve(estado());
    if (abertura) return abertura;
    const pendente = ligar(porta, ++geracao);
    abertura = pendente;
    return pendente.finally(() => { if (abertura === pendente) abertura = null; });
  }

  async function ligar(porta, tentativa) {
    atual = { estado: 'ligando', url: null, erro: null };

    for (const caminho of onde) {
      const r = await tentar(caminho, porta);
      if (tentativa !== geracao) return estado();
      if (r.ok) {
        atual = { estado: 'no-ar', url: r.url, erro: null };
        log(`Sistema na internet: ${r.url}`);
        return estado();
      }
      if (!r.semPrograma) {
        encerrarProcesso();
        atual = { estado: 'erro', url: null, erro: r.erro };
        log(`Não consegui colocar na internet: ${r.erro}`, 'erro');
        return estado();
      }
    }

    atual = { estado: 'sem-programa', url: null, erro: SEM_PROGRAMA };
    return estado();
  }

  function tentar(caminho, porta) {
    return new Promise((pronto) => {
      let filho;
      try {
        filho = spawn(caminho, ['tunnel', '--url', `http://localhost:${porta}`], { windowsHide: true });
      } catch (e) {
        pronto({ ok: false, semPrograma: true, erro: e.message });
        return;
      }
      processo = filho;

      let respondido = false;
      const responder = (r) => {
        if (respondido) return;
        respondido = true;
        clearTimeout(relogio);
        if (cancelarTentativa === cancelar) cancelarTentativa = null;
        pronto(r);
      };
      const cancelar = () => responder({ ok: false });
      cancelarTentativa = cancelar;

      const relogio = setTimeout(() => {
        responder({ ok: false, semPrograma: false, erro: `o cloudflared não respondeu em ${Math.round(esperaMs / 1000)}s` });
      }, esperaMs);

      // o cloudflared escreve o endereco no stderr, nao no stdout
      const observar = () => {
        let restante = '';
        return (pedaco) => {
          restante = (restante + String(pedaco)).slice(-4096);
          const url = enderecoDaLinha(restante);
          if (url) responder({ ok: true, url });
          restante = restante.slice(restante.lastIndexOf('\n') + 1);
        };
      };
      filho.stdout?.on('data', observar());
      filho.stderr?.on('data', observar());

      filho.on('error', (e) => {
        // ENOENT = este caminho nao tem o programa; o laco tenta o proximo
        responder({ ok: false, semPrograma: e.code === 'ENOENT', erro: e.message });
      });
      filho.on('exit', (codigo) => {
        const eraAtual = processo === filho;
        if (eraAtual) processo = null;
        responder({ ok: false, semPrograma: false, erro: `o cloudflared saiu com código ${codigo}` });
        // caiu depois de ter subido: o painel precisa saber
        if (eraAtual && atual.estado === 'no-ar') {
          atual = { estado: 'erro', url: null, erro: 'A ligação com a Cloudflare caiu.' };
          log('O túnel caiu: o sistema não está mais na internet.', 'erro');
        }
      });
    });
  }

  function fechar() {
    geracao++;
    cancelarTentativa?.();
    abertura = null;
    atual = { estado: 'desligado', url: null, erro: null };
    encerrarProcesso();
    log('Sistema tirado da internet.');
    return estado();
  }

  return { estado, abrir, fechar };
}
