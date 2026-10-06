/**
 * Espelho da regra do servidor (api/src/dominio/checkin.ts): uma entrada por
 * hora, por aluno. A tela nao deve oferecer um botao que a API vai recusar --
 * e e esse botao que evita a sequencia de toques registrando a mesma entrada.
 */
export const MINUTOS_ENTRE_CHECKINS = 60;

export interface EstadoCheckin {
  liberado: boolean;
  rotulo: string;
  /** Texto do "title", explicando por que esta segurado. */
  titulo: string;
}

export function estadoDoCheckin(ultimoEm: string | null, agora = new Date()): EstadoCheckin {
  const livre: EstadoCheckin = { liberado: true, rotulo: 'Check-in', titulo: '' };
  if (!ultimoEm) return livre;

  const ultimo = new Date(ultimoEm);
  if (Number.isNaN(ultimo.getTime())) return livre;

  const faltaMs = ultimo.getTime() + MINUTOS_ENTRE_CHECKINS * 60_000 - agora.getTime();
  if (faltaMs <= 0) return livre;

  const min = Math.ceil(faltaMs / 60_000);
  return {
    liberado: false,
    rotulo: `Liberado em ${min} min`,
    titulo: 'Já entrou agora há pouco. O sistema aceita uma entrada por hora para o mesmo aluno.',
  };
}
