import { describe, it, expect } from 'vitest';
import { estadoDoCheckin } from '../src/dominio/checkin';

const hora = (h: string) => new Date(`2026-10-03T${h}:00-03:00`);

describe('estadoDoCheckin', () => {
  it('sem entrada nenhuma, o botao convida', () => {
    expect(estadoDoCheckin(null, hora('08:00'))).toEqual({ liberado: true, rotulo: 'Check-in', titulo: '' });
  });

  it('logo depois de registrar, mostra quanto falta', () => {
    const r = estadoDoCheckin(hora('08:00').toISOString(), hora('08:10'));
    expect(r.liberado).toBe(false);
    expect(r.rotulo).toBe('Liberado em 50 min');
    expect(r.titulo).toMatch(/uma entrada por hora/i);
  });

  it('um minuto fala no singular', () => {
    const meioMinutoAntes = new Date('2026-10-03T08:59:30-03:00');
    expect(estadoDoCheckin(hora('08:00').toISOString(), meioMinutoAntes).rotulo).toBe('Liberado em 1 min');
  });

  it('passada a hora, volta a convidar', () => {
    expect(estadoDoCheckin(hora('08:00').toISOString(), hora('09:01')).liberado).toBe(true);
  });

  it('check-in de ontem nao segura ninguem', () => {
    expect(estadoDoCheckin('2026-10-02T11:00:00.000Z', hora('08:00')).liberado).toBe(true);
  });
});
