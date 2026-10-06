/** Dados estaticos de demonstracao. Nomes e numeros sao ficticios. */

export const NOMES = ['Rafael','Juliana','Thiago','Carla','Marcos','Ana','Bruno','Priscila','Lucas','Fernanda',
  'Gabriel','Camila','Diego','Larissa','Felipe','Beatriz','Gustavo','Mariana','Rodrigo','Aline',
  'Vinicius','Patricia','Leonardo','Renata','Matheus','Tatiane','Eduardo','Vanessa','Caio','Isabela',
  'Andre','Leticia','Ricardo','Natalia','Paulo','Daniela','Henrique','Bianca','Samuel','Jessica'];

export const SOBRENOMES = ['Moura','Pereira','Santos','Alves','Lima','Costa','Ferraz','Nunes','Oliveira','Souza',
  'Rodrigues','Carvalho','Gomes','Martins','Rocha','Ribeiro','Almeida','Barbosa','Cardoso','Teixeira'];

export const RESTRICOES_POSSIVEIS = [
  { tags: ['joelho'], obs: 'Condropatia patelar. Evitar impacto e agachamento profundo.' },
  { tags: ['lombar'], obs: 'Lombalgia recorrente. Evitar carga axial alta.' },
  { tags: ['ombro'], obs: 'Dor ao elevar o braço acima da cabeça.' },
  { tags: ['hipertensao'], obs: 'Hipertensão controlada com medicação.' },
  { tags: ['joelho', 'lombar'], obs: 'Joelho e lombar sensíveis. Priorizar máquinas guiadas.' },
];

export const TAGS_RESTRICAO: Array<[string, string]> = [
  ['joelho','Joelho'],['ombro','Ombro'],['lombar','Lombar'],['cervical','Cervical'],['punho','Punho'],
  ['tornozelo','Tornozelo'],['quadril','Quadril'],['hipertensao','Hipertensão'],['cardiaco','Cardíaco'],
  ['gestante','Gestante'],['hernia','Hérnia'],['diabetes','Diabetes'],
];

export const PLANOS = [
  { nome: 'Básico', precoCentavos: 8900, duracaoMeses: 1, ordem: 1, destaque: false,
    beneficios: ['Musculação + Cardio', 'Horário 6h–20h'] },
  { nome: 'Plus', precoCentavos: 13900, duracaoMeses: 1, ordem: 2, destaque: true,
    beneficios: ['Acesso completo + Aulas', 'Ficha personalizada', 'Avaliação mensal'] },
  { nome: 'Trimestral', precoCentavos: 36900, duracaoMeses: 3, ordem: 3, destaque: false,
    beneficios: ['Tudo do Plus', 'Desconto de 12%'] },
  { nome: 'Anual', precoCentavos: 118800, duracaoMeses: 12, ordem: 4, destaque: false,
    beneficios: ['Tudo do Plus', '2 meses grátis'] },
];

export const ATIVIDADES = ['Musculação','Musculação','Musculação','Cardio','Funcional','Spinning'];

type Nv = 'iniciante' | 'intermediario' | 'avancado';
/** Biblioteca. Contraindicacoes usam os mesmos codigos de tag_restricao. */
export const EXERCICIOS: Array<[string, string, string, string, Nv, string[]]> = [
  ['Supino reto com barra', 'peito', 'empurrar_horizontal', 'Barra livre', 'intermediario', ['ombro']],
  ['Supino inclinado com halteres', 'peito', 'empurrar_horizontal', 'Halteres', 'iniciante', ['ombro']],
  ['Crucifixo na máquina', 'peito', 'isolado', 'Pec Deck', 'iniciante', []],
  ['Flexão de braço', 'peito', 'empurrar_horizontal', 'Peso corporal', 'iniciante', ['punho']],
  ['Desenvolvimento com halteres', 'ombro', 'empurrar_vertical', 'Halteres', 'intermediario', ['ombro', 'cervical']],
  ['Elevação lateral', 'ombro', 'isolado', 'Halteres', 'iniciante', ['ombro']],
  ['Puxada frontal', 'costas', 'puxar_vertical', 'Lat Pull', 'iniciante', []],
  ['Remada baixa', 'costas', 'puxar_horizontal', 'Cabo (polia)', 'iniciante', []],
  ['Remada curvada com barra', 'costas', 'puxar_horizontal', 'Barra livre', 'avancado', ['lombar']],
  ['Barra fixa', 'costas', 'puxar_vertical', 'Barra fixa', 'avancado', ['ombro']],
  ['Rosca direta', 'biceps', 'isolado', 'Barra livre', 'iniciante', ['punho']],
  ['Rosca martelo', 'biceps', 'isolado', 'Halteres', 'iniciante', []],
  ['Tríceps na polia', 'triceps', 'isolado', 'Cabo (polia)', 'iniciante', []],
  ['Tríceps francês', 'triceps', 'isolado', 'Halteres', 'intermediario', ['ombro']],
  ['Agachamento livre', 'pernas', 'agachar', 'Barra livre', 'intermediario', ['joelho', 'lombar']],
  ['Leg press 45 graus', 'pernas', 'agachar', 'Leg Press', 'iniciante', []],
  ['Cadeira extensora', 'pernas', 'isolado', 'Cadeira Extensora', 'iniciante', []],
  ['Cadeira flexora', 'pernas', 'isolado', 'Cadeira Flexora', 'iniciante', []],
  ['Afundo com halteres', 'pernas', 'agachar', 'Halteres', 'intermediario', ['joelho']],
  ['Levantamento terra', 'posterior', 'dobradica_quadril', 'Barra livre', 'avancado', ['lombar', 'hernia']],
  ['Stiff com halteres', 'posterior', 'dobradica_quadril', 'Halteres', 'intermediario', ['lombar']],
  ['Elevação pélvica', 'gluteo', 'dobradica_quadril', 'Barra livre', 'iniciante', []],
  ['Cadeira abdutora', 'gluteo', 'isolado', 'Cadeira Abdutora', 'iniciante', []],
  ['Panturrilha em pé', 'pernas', 'isolado', 'Máquina', 'iniciante', []],
  ['Prancha', 'core', 'core', 'Peso corporal', 'iniciante', ['lombar']],
  ['Abdominal na máquina', 'core', 'core', 'Máquina', 'iniciante', ['hernia']],
  ['Esteira caminhada', 'cardio', 'cardio', 'Esteira', 'iniciante', []],
  ['Elíptico', 'cardio', 'cardio', 'Elíptico', 'iniciante', []],
  ['Bike ergométrica', 'cardio', 'cardio', 'Bike ergométrica', 'iniciante', []],
  ['Corrida na esteira', 'cardio', 'cardio', 'Esteira', 'intermediario', ['joelho', 'cardiaco']],
];

/** nome, diaSemana, hora, duracao, vagas, local, indice do professor na equipe */
export const AULAS: Array<[string, number, string, number, number, string, number]> = [
  ['Spinning', 1, '06:30', 60, 20, 'Sala de Spinning', 1],
  ['Funcional', 1, '07:00', 45, 15, 'Área Funcional', 2],
  ['Funcional', 1, '19:00', 45, 15, 'Área Funcional', 2],
  ['Yoga', 2, '09:00', 60, 12, 'Sala 2', 2],
  ['Spinning', 2, '19:30', 60, 20, 'Sala de Spinning', 1],
  ['Pilates', 3, '18:00', 50, 10, 'Sala de Pilates', 2],
  ['Spinning', 4, '19:00', 60, 20, 'Sala de Spinning', 1],
  ['Funcional', 5, '07:00', 45, 15, 'Área Funcional', 2],
  ['Funcional', 5, '18:30', 45, 15, 'Área Funcional', 2],
  ['Alongamento', 6, '09:00', 40, 15, 'Sala 2', 2],
];
