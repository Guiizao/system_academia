/** Contraste entre duas cores, pela formula da WCAG. 4.5 e o minimo AA para texto. */

function canal(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const h = hex.trim().replace('#', '');
  const completo = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(completo, 16);
  if (Number.isNaN(n) || completo.length !== 6) throw new Error(`Cor inválida: ${hex}`);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function contraste(corA: string, corB: string): number {
  const [a, b] = [luminancia(corA), luminancia(corB)];
  const [claro, escuro] = a > b ? [a, b] : [b, a];
  return (claro + 0.05) / (escuro + 0.05);
}
