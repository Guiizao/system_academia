import { describe, it, expect } from 'vitest';
import { MINUTOS_ENTRE_CHECKINS, intervaloDeCheckin } from '../../src/dominio/checkin.js';

const hora = (h: string) => new Date(`2026-10-03T${h}:00-03:00`);

describe('intervaloDeCheckin', () => {
  it('quem nunca entrou esta liberado', () => {
    expect(intervaloDeCheckin(null, hora('08:00'))).toMatchObject({ liberado: true, faltamMinutos: 0 });
  });

  it('segundo toque logo depois do primeiro e barrado', () => {
    const r = intervaloDeCheckin(hora('08:00').toISOString(), hora('08:00'));
    expect(r.liberado).toBe(false);
    expect(r.faltamMinutos).toBe(MINUTOS_ENTRE_CHECKINS);
    expect(r.liberadoEm).toBe(hora('09:00').toISOString());
  });

  it('arredonda para cima os minutos que faltam', () => {
    expect(intervaloDeCheckin(hora('08:00').toISOString(), hora('08:30')).faltamMinutos).toBe(30);
    expect(intervaloDeCheckin(hora('08:00').toISOString(), hora('08:59')).faltamMinutos).toBe(1);
  });

  it('passada uma hora, libera de novo (duas entradas no mesmo dia sao normais)', () => {
    expect(intervaloDeCheckin(hora('08:00').toISOString(), hora('09:00')).liberado).toBe(true);
    expect(intervaloDeCheckin(hora('08:00').toISOString(), hora('19:30')).liberado).toBe(true);
  });

  it('data do ultimo check-in quebrada nao trava o aluno', () => {
    expect(intervaloDeCheckin('nao e data', hora('08:00')).liberado).toBe(true);
  });

  it('relogio do PC atrasado nao libera check-in em sequencia', () => {
    // ultimo check-in "no futuro": ainda assim espera o intervalo cheio
    expect(intervaloDeCheckin(hora('10:00').toISOString(), hora('08:00')).liberado).toBe(false);
  });
});
