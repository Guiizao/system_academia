/**
 * Mostrar ou esconder os valores em dinheiro.
 *
 * A recepção fica de frente para o salão: qualquer aluno encostado no balcão
 * lê o faturamento do mês na tela. O olhinho esconde tudo que é dinheiro de
 * uma vez só — e é UMA escolha para o sistema inteiro, não uma por tela:
 * esconder no Início e o número continuar aberto no Financeiro não serviria
 * de nada.
 *
 * A escolha vale só para este aparelho (como o tema e os efeitos) e NÃO é
 * segurança: quem tem a senha vê tudo clicando no olho. Serve contra olhar
 * de passagem, que é o problema real no balcão.
 */

const CHAVE = 'df-valores';

type Ouvinte = (visivel: boolean) => void;
const ouvintes = new Set<Ouvinte>();

function ler(): boolean {
  try {
    // o padrão é MOSTRAR: quem nunca mexeu não deve estranhar a tela
    return localStorage.getItem(CHAVE) !== 'ocultos';
  } catch {
    return true; // navegador sem armazenamento
  }
}

let visivel = ler();

export function valoresVisiveis(): boolean {
  return visivel;
}

export function alternarValores(): void {
  visivel = !visivel;
  try { localStorage.setItem(CHAVE, visivel ? 'visiveis' : 'ocultos'); } catch { /* vale só nesta sessão */ }
  for (const ouvinte of [...ouvintes]) ouvinte(visivel);
}

/** Avisa quando alguém clicar no olho, em qualquer tela. Devolve o cancelador. */
export function ouvirValores(fn: Ouvinte): () => void {
  ouvintes.add(fn);
  return () => { ouvintes.delete(fn); };
}
