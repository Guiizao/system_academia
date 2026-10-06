/** Tipos das respostas da API (espelham api/src/servicos). */

export type DataISO = string;
export type Papel = 'dono' | 'recepcao' | 'professor';
export type StatusAluno = 'ativo' | 'vencendo' | 'vencido' | 'inativo';
export type FormaPagamento = 'pix' | 'dinheiro' | 'credito' | 'debito' | 'boleto';
export type Objetivo = 'hipertrofia' | 'emagrecimento' | 'definicao' | 'condicionamento' | 'saude_geral' | 'reabilitacao';
export type Nivel = 'iniciante' | 'intermediario' | 'avancado';

export interface Usuario {
  id: number; nome: string; email: string; papel: Papel;
  cref: string | null; especialidade: string | null;
}

export interface Matricula {
  id: number; alunoId: number; planoId: number;
  dataInicio: DataISO; dataFim: DataISO; diaAncora: number; valorCentavos: number;
  status: 'ativa' | 'encerrada' | 'cancelada';
}

export interface AvaliacaoFisica {
  id: number; alunoId: number; data: DataISO;
  pesoKg: number | null; alturaM: number | null; percGordura: number | null;
  circBraco: number | null; circPeito: number | null; circCintura: number | null;
  circQuadril: number | null; circCoxa: number | null; circOmbros: number | null;
  objetivo: Objetivo | null; nivel: Nivel | null;
}

export interface Aluno {
  id: number; nome: string; telefone: string;
  email: string | null; cpf: string | null; sexo: string | null; dataNascimento: string | null;
  observacoesMedicas: string | null; restricoes: string[]; aceitaWhatsapp: boolean;
  status: StatusAluno; diasParaVencer: number | null; planoNome: string | null;
  matricula: Matricula | null; ultimaAvaliacao: AvaliacaoFisica | null;
  checkinsNoMes: number; ultimoCheckin: DataISO | null;
  /** hora do ultimo check-in (ISO), para o botao esperar o intervalo */
  ultimoCheckinEm: string | null;
}

export interface Plano {
  id: number; nome: string; precoCentavos: number; duracaoMeses: number;
  /** diária: quantos dias vale. null = plano por mês */
  duracaoDias: number | null;
  beneficios: string[]; destaque: boolean;
  /** posicao na lista; o dono muda com as setas */
  ordem: number;
  /** plano desativado sai da lista de venda; as matrículas dele continuam valendo */
  ativo: boolean;
}

export interface Checkin {
  id: number; alunoId: number; dataHora: string; dataLocal: DataISO; atividade: string;
}

export interface Pagamento {
  id: number; alunoId: number; alunoNome?: string; valorCentavos: number;
  forma: FormaPagamento; dataPagamento: DataISO; observacao: string | null;
}

export interface Cobranca {
  id: number; alunoId: number; alunoNome: string; competencia: string;
  valorCentavos: number; vencimento: DataISO;
}

export interface AulaDoDia {
  id: number; nome: string; hora: string; duracaoMin: number; vagas: number;
  local: string | null; professorNome: string | null; data: DataISO; inscritos: number;
}

export interface FichaItem {
  ordem: number; series: number; reps: string; descansoSeg: number;
  cargaOrientacao: string | null; exercicioId: number; exercicioNome: string; equipamento: string;
}

export interface FichaTreino {
  id: number; alunoId: number; objetivo: string; nivel: string; diasPorSemana: number;
  status: 'rascunho' | 'aprovada' | 'arquivada'; geradaPor: string; criadoEm: string;
  aprovadaPorNome: string | null; aprovadaCref: string | null; aprovadaEm: string | null;
  divisoes: Array<{ id: number; rotulo: string; foco: string; itens: FichaItem[] }>;
}

export interface Dashboard {
  academia: string;
  ativos: number; vencendo: number; vencidos: number; inativos: number;
  checkinsHoje: number; aulasHoje: number; ocupacaoPct: number;
  // ausentes para quem nao e dono: o servidor remove
  receitaMesCentavos?: number; recebidoHojeCentavos?: number; inadimplenciaCentavos?: number;
  aVencer: Aluno[]; sumidos: Aluno[];
  checkinsRecentes: Array<Checkin & { alunoNome: string; alunoStatus: StatusAluno }>;
}

export interface Config {
  academia: { nome: string; responsavel: string | null; pixChave: string | null;
    diasAvisoVencimento: number; diasAlunoSumido: number };
  iaHabilitada: boolean;
  equipe: Array<{ id: number; nome: string; papel: Papel; cref: string | null; especialidade: string | null }>;
}

export interface Aviso {
  tipo: 'vencido' | 'vencendo' | 'sumido' | 'ficha' | 'cobranca';
  gravidade: 'alta' | 'media';
  titulo: string;
  detalhe: string;
  alunoId?: number;
}

export interface Membro {
  id: number; nome: string; email: string; papel: Papel;
  cref: string | null; especialidade: string | null; telefone: string | null;
  ativo: boolean; ultimoLogin: string | null;
}

export interface Exercicio {
  id: number; nome: string; grupoMuscular: string; padraoMovimento: string;
  equipamento: string; nivelMinimo: Nivel; contraindicacoes: string[];
  seriesMin: number; seriesMax: number;
}

export interface RelatorioMes {
  mes: string;
  mesPorExtenso: string;
  academia: string;
  receitaCentavos: number;
  pagamentos: number;
  ticketMedioCentavos: number;
  mesAnteriorCentavos: number;
  /** null quando nao havia mes anterior: nao da para falar em variacao */
  variacaoPct: number | null;
  formas: Array<{ forma: string; totalCentavos: number; quantidade: number }>;
  porPlano: Array<{ plano: string; alunos: number }>;
  serie: Array<{ mes: string; totalCentavos: number; pagamentos: number }>;
  /** resumo pronto para mandar no WhatsApp */
  texto: string;
}

/**
 * O que o servidor responde antes de a recepção confirmar o pagamento.
 * Serve para a tela mostrar o vencimento que VAI sair -- sem esta prévia
 * ninguém consegue ver que pagar adiantado não encurta o mês.
 */
export type PreviaPagamento = {
  dataInicio: DataISO;
  dataFim: DataISO;
  diaAncora: number;
  /** vencimento de hoje; null quando o aluno ainda não tem matrícula */
  dataFimAnterior: DataISO | null;
  /** dias que ainda faltavam e foram aproveitados por pagar antes de vencer */
  diasAproveitados: number;
  periodos: number;
  valorCentavos: number;
  planoNome: string;
};
