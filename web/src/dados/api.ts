import { get, post, put, del } from './cliente';
import type {
  Aluno, AvaliacaoFisica, AulaDoDia, Checkin, Cobranca, Config, Dashboard,
  FichaTreino, FormaPagamento, Pagamento, Plano, StatusAluno, Usuario,
  Aviso, Membro, Exercicio, RelatorioMes, PreviaPagamento } from '../tipos';

const qs = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]);
  return p.toString() ? `?${p}` : '';
};

export const api = {
  login: (email: string, senha: string) => post<{ usuario: Usuario }>('/api/auth/login', { email, senha }),
  logout: () => post('/api/auth/logout'),
  eu: () => get<{ usuario: Usuario }>('/api/auth/eu'),

  dashboard: () => get<Dashboard>('/api/dashboard'),
  config: () => get<Config>('/api/config'),

  alunos: (f: { busca?: string; status?: StatusAluno | 'todos' } = {}) =>
    get<Aluno[]>(`/api/alunos${qs({ busca: f.busca, status: f.status })}`),
  aluno: (id: number) => get<Aluno>(`/api/alunos/${id}`),
  criarAluno: (d: Record<string, unknown>) => post<Aluno>('/api/alunos', d),
  avaliacoes: (id: number) => get<AvaliacaoFisica[]>(`/api/alunos/${id}/avaliacoes`),
  checkinsDoAluno: (id: number) => get<Checkin[]>(`/api/alunos/${id}/checkins`),
  pagamentosDoAluno: (id: number) => get<Pagamento[]>(`/api/alunos/${id}/pagamentos`),
  fichasDoAluno: (id: number) => get<FichaTreino[]>(`/api/alunos/${id}/fichas`),

  registrarCheckin: (alunoId: number, atividade: string) => post<Checkin>('/api/checkins', { alunoId, atividade }),

  /** todos=true inclui os desativados (so o dono recebe) */
  planos: (todos = false) => get<Plano[]>(`/api/planos${todos ? '?todos=1' : ''}`),
  excluirPlano: (id: number) => del<{ id: number; nome: string }>(`/api/planos/${id}`),
  ordenarPlanos: (ids: number[]) => post<Plano[]>('/api/planos/ordem', { ids }),
  atualizarPlano: (id: number, d: Partial<Plano>) => put<Plano>(`/api/planos/${id}`, d),
  criarPlano: (d: {
    nome: string; precoCentavos: number; duracaoMeses: number;
    duracaoDias?: number | null; beneficios?: string[];
  }) => post<Plano>('/api/planos', d),
  relatorioFinanceiro: (mes?: string) =>
    get<RelatorioMes>(`/api/relatorios/financeiro${mes ? `?mes=${mes}` : ''}`),
  cobrancas: () => get<Cobranca[]>('/api/cobrancas'),
  pixDaCobranca: (id: number) => get<{ payload: string; valorCentavos: number }>(`/api/cobrancas/${id}/pix`),
  pixAvulso: (valorCentavos: number) => get<{ payload: string; valorCentavos: number }>(`/api/pix?valor=${valorCentavos}`),
  pagamentos: () => get<Pagamento[]>('/api/pagamentos'),
  /** O vencimento que vai sair, calculado pelo servidor, antes de gravar. */
  previaPagamento: (d: {
    alunoId: number; planoId: number; dataPagamento?: string;
    periodos?: number; dataInicioEscolhida?: string | null; dataFimManual?: string | null;
  }) => get<PreviaPagamento>(`/api/pagamentos/previa${qs({
    alunoId: String(d.alunoId), planoId: String(d.planoId), dataPagamento: d.dataPagamento,
    periodos: d.periodos ? String(d.periodos) : undefined,
    dataInicioEscolhida: d.dataInicioEscolhida ?? undefined,
    dataFimManual: d.dataFimManual ?? undefined,
  })}`),
  registrarPagamento: (d: {
    alunoId: number; valorCentavos: number; forma: FormaPagamento;
    cobrancaId?: number; planoId?: number; observacao?: string;
    /** 2 = o aluno pagou este período e o próximo, de uma vez */
    periodos?: number;
    /** quando a recepção registra um pagamento de outro dia */
    dataPagamento?: string;
    /** diária marcada para um dia específico */
    dataInicioEscolhida?: string | null;
    /** vencimento na mão, em vez do calculado */
    dataFimManual?: string | null;
  }) => post('/api/pagamentos', d),
  distribuicao: () => get<Array<{ plano: Plano; quantidade: number }>>('/api/financeiro/distribuicao'),

  aulasDoDia: (data: string) => get<AulaDoDia[]>(`/api/aulas?data=${data}`),
  inscritosDaAula: (aulaId: number, data: string) => get<number[]>(`/api/aulas/${aulaId}/inscricoes?data=${data}`),
  inscrever: (aulaId: number, alunoId: number, data: string) =>
    post(`/api/aulas/${aulaId}/inscricoes`, { alunoId, data }),

  fichas: () => get<FichaTreino[]>('/api/fichas'),
  aprovarFicha: (id: number) => post<FichaTreino>(`/api/fichas/${id}/aprovar`),
  gerarFichaIA: () => post('/api/fichas/gerar'),
  criarFicha: (d: {
    alunoId: number; objetivo: string; nivel: string; diasPorSemana: number;
    divisoes: Array<{ rotulo: string; foco: string; itens: Array<{
      exercicioId: number; series: number; reps: string; descansoSeg: number; cargaOrientacao?: string;
    }> }>;
  }) => post<FichaTreino>('/api/fichas', d),
  exercicios: () => get<Exercicio[]>('/api/exercicios'),

  atualizarAluno: (id: number, d: Record<string, unknown>) => put<Aluno>(`/api/alunos/${id}`, d),
  registrarAvaliacao: (id: number, d: Record<string, unknown>) => post<AvaliacaoFisica>(`/api/alunos/${id}/avaliacoes`, d),

  criarAula: (d: { nome: string; diaSemana: number; hora: string; duracaoMin: number; vagas: number; local?: string; professorUsuarioId?: number }) =>
    post('/api/aulas', d),
  atualizarAula: (id: number, d: Record<string, unknown>) => put(`/api/aulas/${id}`, d),

  avisos: () => get<Aviso[]>('/api/avisos'),
  academia: () => get<Record<string, any>>('/api/academia'),
  atualizarAcademia: (d: Record<string, unknown>) => put('/api/academia', d),

  equipe: () => get<Membro[]>('/api/usuarios'),
  criarMembro: (d: { nome: string; email: string; papel: string; senhaInicial: string; cref?: string; especialidade?: string }) =>
    post<Membro>('/api/usuarios', d),
  atualizarMembro: (id: number, d: Record<string, unknown>) => put<Membro>(`/api/usuarios/${id}`, d),
  redefinirSenha: (id: number, novaSenha: string) => post(`/api/usuarios/${id}/senha`, { novaSenha }),
  trocarMinhaSenha: (senhaAtual: string, novaSenha: string) => post('/api/auth/senha', { senhaAtual, novaSenha }),
};
