import type { DataISO, StatusAluno, Nivel, Objetivo } from '../tipos';

/* ─── dinheiro ─────────────────────────────────────────────
   Centavos inteiros. Nunca float — 89.9 * 100 dá 8989.99…    */

export function formatarBRL(centavos: number): string {
  if (!Number.isInteger(centavos)) throw new Error(`Centavos deve ser inteiro: ${centavos}`);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(centavos / 100).replace(/ /g, ' ');
}

/** Versão compacta para dashboards: R$ 1,2 mil */
export function formatarBRLCurto(centavos: number): string {
  const reais = centavos / 100;
  if (reais >= 1000) return `R$ ${(reais / 1000).toFixed(1).replace('.', ',')} mil`;
  return formatarBRL(centavos);
}

/* ─── datas ────────────────────────────────────────────────
   Data de calendário como texto ISO. Sem Date, sem fuso.      */

export function hoje(): DataISO {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function diffDias(de: DataISO, ate: DataISO): number {
  const [a1, m1, d1] = de.split('-').map(Number);
  const [a2, m2, d2] = ate.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

export function formatarData(d: DataISO): string {
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}/${a}`;
}

export function formatarDataCurta(d: DataISO): string {
  const [, m, dia] = d.split('-');
  return `${dia}/${m}`;
}

export function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** "Há 4 min", "Há 2 h", "Ontem" */
export function tempoRelativo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

/* ─── status derivado ──────────────────────────────────────
   Uma implementação só. A mesma regra roda no backend (§5.1). */

export function statusDoAluno(
  dataFim: DataISO | null,
  hojeISO: DataISO,
  diasAviso: number,
): StatusAluno {
  if (!dataFim) return 'inativo';
  const dias = diffDias(hojeISO, dataFim);
  if (dias < 0) return 'vencido';
  if (dias <= diasAviso) return 'vencendo';
  return 'ativo';
}

export const ROTULO_STATUS: Record<StatusAluno, string> = {
  ativo: 'Ativo',
  vencendo: 'Vencendo',
  vencido: 'Vencido',
  inativo: 'Inativo',
};

export const CLASSE_STATUS: Record<StatusAluno, string> = {
  ativo: 'b-ok',
  vencendo: 'b-warn',
  vencido: 'b-danger',
  inativo: 'b-mudo',
};

/** Texto que a recepção lê antes de confirmar o check-in (§5.3). */
export function avisoStatus(status: StatusAluno, dias: number | null): string | null {
  if (status === 'vencido' && dias !== null) {
    const n = Math.abs(dias);
    return `Vencido há ${n} ${n === 1 ? 'dia' : 'dias'}`;
  }
  if (status === 'vencendo' && dias !== null) {
    if (dias === 0) return 'Vence hoje';
    return dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`;
  }
  if (status === 'inativo') return 'Sem matrícula ativa';
  return null;
}

/* ─── medidas ──────────────────────────────────────────── */

export function calcularIMC(pesoKg?: number, alturaM?: number): number | null {
  if (!pesoKg || !alturaM) return null;
  return Number((pesoKg / (alturaM * alturaM)).toFixed(1));
}

export function categoriaIMC(imc: number | null): string {
  if (imc === null) return '—';
  if (imc < 18.5) return 'Abaixo';
  if (imc < 25) return 'Normal';
  if (imc < 30) return 'Sobrepeso';
  return 'Obesidade';
}

/* ─── texto ────────────────────────────────────────────── */

export function iniciais(nome: string): string {
  return nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase();
}

export function formatarTelefone(e164: string): string {
  const d = e164.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return e164;
}

export const ROTULO_OBJETIVO: Record<Objetivo, string> = {
  hipertrofia: 'Hipertrofia',
  emagrecimento: 'Emagrecimento',
  definicao: 'Definição muscular',
  condicionamento: 'Condicionamento',
  saude_geral: 'Saúde geral',
  reabilitacao: 'Reabilitação',
};

export const ROTULO_NIVEL: Record<Nivel, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

export const DIAS_SEMANA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
