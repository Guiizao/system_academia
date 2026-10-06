/**
 * Intervalo minimo entre dois check-ins do mesmo aluno.
 *
 * Sem isso, apertar o botao varias vezes (ou dois celulares na recepcao)
 * registra a mesma entrada repetida e a contagem do mes vira ficcao.
 * Uma hora deixa passar quem treina de manha e volta a noite, que e normal.
 */
export const MINUTOS_ENTRE_CHECKINS = 60;

export interface IntervaloCheckin {
  liberado: boolean;
  faltamMinutos: number;
  /** Quando o proximo check-in passa a valer (ISO), ou null se ja esta liberado. */
  liberadoEm: string | null;
}

export function intervaloDeCheckin(
  ultimoEm: string | null | undefined,
  agora = new Date(),
  minutos = MINUTOS_ENTRE_CHECKINS,
): IntervaloCheckin {
  const liberado: IntervaloCheckin = { liberado: true, faltamMinutos: 0, liberadoEm: null };
  if (!ultimoEm) return liberado;

  const ultimo = new Date(ultimoEm);
  if (Number.isNaN(ultimo.getTime())) return liberado;  // registro antigo estranho nao trava ninguem

  const fim = new Date(ultimo.getTime() + minutos * 60_000);
  const restanteMs = fim.getTime() - agora.getTime();
  if (restanteMs <= 0) return liberado;

  return {
    liberado: false,
    // para cima: faltando 30 s, a tela diz "1 minuto", nao "0"
    faltamMinutos: Math.ceil(restanteMs / 60_000),
    liberadoEm: fim.toISOString(),
  };
}
