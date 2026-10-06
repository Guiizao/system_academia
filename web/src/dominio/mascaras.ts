/**
 * Mascaras de digitacao. Rodam a cada tecla: o campo mostra o formato pronto
 * enquanto a pessoa digita, em vez de so sugerir no placeholder.
 * O que vai para o servidor e sempre `soDigitos`.
 */

export const soDigitos = (texto: string): string => (texto ?? '').replace(/\D/g, '');

/**
 * (11) 9 9999-9999 para celular e (11) 3333-4444 para fixo. Enquanto nao da
 * para saber qual e, segue o formato de celular -- que e o caso de quase todo
 * aluno. Colar "+55 11 99999-9999" funciona: o 55 da frente cai fora.
 */
export function mascararTelefone(texto: string): string {
  let d = soDigitos(texto);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (!d) return '';

  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (d.length === 1) return `(${d}`;
  if (!resto) return `(${ddd}) `;

  // telefone fixo no Brasil comeca em 2-5; so celular comeca em 9. Por isso da
  // para escolher o formato ja no primeiro digito depois do DDD.
  const celular = resto[0] === '9';
  if (!celular) {                     // fixo: (11) 3333-4444
    const parte1 = resto.slice(0, 4);
    const parte2 = resto.slice(4);
    return `(${ddd}) ${parte1}${parte2 ? `-${parte2}` : ''}`;
  }
  // celular: (11) 9 9999-9999
  const meio = resto.slice(1, 5);
  const fim = resto.slice(5);
  return `(${ddd}) ${resto[0]}${meio ? ` ${meio}` : ''}${fim ? `-${fim}` : ''}`;
}

/** 000.000.000-00, formatado conforme digita. */
export function mascararCPF(texto: string): string {
  const d = soDigitos(texto).slice(0, 11);
  if (!d) return '';
  const partes = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean);
  const fim = d.slice(9);
  return partes.join('.') + (fim ? `-${fim}` : '');
}
