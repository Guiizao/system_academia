import { Children, useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { BarrasVerticais } from '../componentes/Grafico';
import { mesCurto } from '../dominio/grafico';
import { useSessao } from '../sessao';
import { formatarBRL, iniciais, tempoRelativo, CLASSE_STATUS, ROTULO_STATUS, avisoStatus } from '../dominio';
import type { Tela } from '../componentes/Shell';
import { IconeMais, IconeCheckin, IconeFinanceiro, IconeAgenda, IconeWhats } from '../componentes/Icones';
import './Dashboard.css';

function saudacao(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export function Dashboard({ aoNavegar, aoAbrirAluno }: { aoNavegar: (t: Tela) => void; aoAbrirAluno: (id: number) => void }) {
  const { usuario } = useSessao();
  const { dados: r, erro } = useDados(() => api.dashboard(), [], { aCadaMs: 30_000 });
  // serie do grafico: so o dono recebe numero de dinheiro consolidado
  const { dados: rel } = useDados(
    () => (usuario.papel === 'dono' ? api.relatorioFinanceiro() : Promise.resolve(null)), [usuario.papel]);

  if (erro) return <div className="erro-carga">Não foi possível carregar o painel: {erro}</div>;
  if (!r) return <EsqueletoInicio />;
  // o servidor so envia os valores de dinheiro para o dono
  const temFinanceiro = r.receitaMesCentavos !== undefined;

  return (
    <div className="container entrar">
      <header className="dash__ola">
        <h1>{saudacao()}, {usuario.nome.split(' ')[0]}</h1>
        <p>{dataPorExtenso()}</p>
      </header>

      <section className="numeros escalonar" aria-label="Resumo de alunos">
        <Numero valor={r.ativos} rotulo="Alunos ativos" />
        <Numero valor={r.checkinsHoje} rotulo="Check-ins hoje" />
        <Numero valor={r.vencendo} rotulo="Vencendo" ponto="warn" />
        <Numero valor={r.vencidos} rotulo="Vencidos" ponto="danger" />
      </section>

      <div className="dash__grade">
        <section className="dash__col">
          <nav className="atalhos" aria-label="Atalhos">
            <Atalho Icone={IconeCheckin} rotulo="Check-in" onClick={() => aoNavegar('alunos')} />
            <Atalho Icone={IconeMais} rotulo="Novo aluno" onClick={() => aoNavegar('alunos')} />
            {usuario.papel !== 'professor' && <Atalho Icone={IconeFinanceiro} rotulo="Receber" onClick={() => aoNavegar('financeiro')} />}
            <Atalho Icone={IconeAgenda} rotulo="Agenda" onClick={() => aoNavegar('agenda')} />
          </nav>

          {temFinanceiro && (
            <div className="painel receita">
              <span className="painel__rot">Receita do mês</span>
              <span className="receita__valor num">{formatarBRL(r.receitaMesCentavos!)}</span>
              <div className="receita__linha">
                <div><span>Recebido hoje</span><strong className="num">{formatarBRL(r.recebidoHojeCentavos!)}</strong></div>
                <div><span>Em atraso</span><strong className={`num ${r.inadimplenciaCentavos ? 't-danger' : ''}`}>{formatarBRL(r.inadimplenciaCentavos!)}</strong></div>
              </div>
            </div>
          )}

          {temFinanceiro && rel && rel.serie.some((m) => m.totalCentavos > 0) && (
            <div className="painel">
              <div className="painel__cab"><strong>Receita dos últimos meses</strong></div>
              <BarrasVerticais
                altura={96}
                dados={rel.serie.map((m) => ({
                  rotulo: mesCurto(m.mes, m.mes.endsWith('-01')),
                  valor: m.totalCentavos,
                  detalhe: `${m.pagamentos} ${m.pagamentos === 1 ? 'pagamento' : 'pagamentos'}`,
                  destaque: m.mes === rel.mes,
                }))}
                formatar={formatarBRL}
              />
            </div>
          )}

          <div className="painel">
            <div className="painel__cab"><strong>Hoje na academia</strong><span className="painel__nota">atualiza sozinho</span></div>
            <div className="hoje">
              <div><b className="num">{r.checkinsHoje}</b><small>entradas</small></div>
              <div><b className="num">{r.aulasHoje}</b><small>aulas</small></div>
              <div><b className="num">{r.ocupacaoPct}%</b><small>ocupação das aulas</small></div>
            </div>
          </div>
        </section>

        <section className="dash__col">
          {r.aVencer.length > 0 && (
            <Lista titulo="Planos vencendo" ponto="warn" qtd={r.aVencer.length}>
              {r.aVencer.map((a) => (
                <button key={a.id} className="linha" onClick={() => aoAbrirAluno(a.id)}>
                  <span className="linha__nome">{a.nome}</span>
                  <span className="linha__detalhe">{avisoStatus(a.status, a.diasParaVencer)}</span>
                  <span className="whats-off" title="Envio pelo WhatsApp: desativado por enquanto"><IconeWhats size={13} /></span>
                </button>
              ))}
            </Lista>
          )}

          {r.sumidos.length > 0 && (
            <Lista titulo="Sumidos" ponto="purple" qtd={r.sumidos.length} nota="Plano em dia, mas sem aparecer. É quem cancela no mês seguinte.">
              {r.sumidos.slice(0, 8).map((a) => (
                <button key={a.id} className="linha" onClick={() => aoAbrirAluno(a.id)}>
                  <span className="linha__nome">{a.nome}</span>
                  <span className="linha__detalhe">{a.ultimoCheckin ? `último em ${a.ultimoCheckin.slice(8, 10)}/${a.ultimoCheckin.slice(5, 7)}` : 'nunca veio'}</span>
                </button>
              ))}
            </Lista>
          )}

          <Lista titulo="Últimas entradas">
            {!r.checkinsRecentes.length && <div className="vazio"><strong>Nenhuma entrada ainda</strong>O primeiro check-in do dia aparece aqui.</div>}
            {r.checkinsRecentes.slice(0, 6).map((c) => (
              <button key={c.id} className="linha linha--aluno" onClick={() => aoAbrirAluno(c.alunoId)}>
                <span className="avatar sm">{iniciais(c.alunoNome)}</span>
                <span className="linha__nome">{c.alunoNome}<small>{c.atividade}, {tempoRelativo(c.dataHora)}</small></span>
                <span className={`badge ${CLASSE_STATUS[c.alunoStatus]}`}>{ROTULO_STATUS[c.alunoStatus]}</span>
              </button>
            ))}
          </Lista>
        </section>
      </div>
    </div>
  );
}

function dataPorExtenso(): string {
  const t = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function Numero({ valor, rotulo, ponto }: { valor: number; rotulo: string; ponto?: 'warn' | 'danger' }) {
  return (
    <div className="numero">
      <span className="numero__rot">{ponto && <i className={`ponto ${ponto}`} />}{rotulo}</span>
      <span className="numero__val num">{valor}</span>
    </div>
  );
}

function Atalho({ Icone, rotulo, onClick }: { Icone: any; rotulo: string; onClick: () => void }) {
  return (
    <button className="atalho" onClick={onClick}>
      <Icone size={18} /><span>{rotulo}</span>
    </button>
  );
}

/**
 * Lista curta por padrao. Antes a tela despejava tudo e virava um rolo sem
 * fim; agora mostra os primeiros e deixa abrir o resto.
 */
function Lista({ titulo, ponto, qtd, nota, limite = 4, children }: {
  titulo: string; ponto?: string; qtd?: number; nota?: string; limite?: number; children: React.ReactNode;
}) {
  const [tudo, setTudo] = useState(false);
  const itens = Children.toArray(children);
  const cortaveis = itens.length > limite;
  const visiveis = tudo || !cortaveis ? itens : itens.slice(0, limite);

  return (
    <div className="painel lista">
      <div className="painel__cab">
        <strong>{ponto && <i className={`ponto ${ponto}`} />}{titulo}</strong>
        {qtd !== undefined && <span className="painel__nota num">{qtd}</span>}
      </div>
      {nota && <p className="lista__nota">{nota}</p>}
      <div className="escalonar">{visiveis}</div>
      {cortaveis && (
        <button className="lista__mais" onClick={() => setTudo((v) => !v)} aria-expanded={tudo}>
          {tudo ? 'Mostrar menos' : `Ver todos (${itens.length})`}
        </button>
      )}
    </div>
  );
}

/** Formato da tela antes dos dados: nada pula de lugar quando eles chegam. */
function EsqueletoInicio() {
  return (
    <div className="container" aria-busy="true" aria-label="Carregando">
      <header className="dash__ola"><span className="esq" style={{ width: 220, height: 26 }} /><span className="esq" style={{ width: 160, height: 14, marginTop: 10 }} /></header>
      <section className="numeros">
        {[0, 1, 2, 3].map((i) => <div key={i} className="numero"><span className="esq" style={{ width: 90, height: 12 }} /><span className="esq" style={{ width: 54, height: 30, marginTop: 10 }} /></div>)}
      </section>
      <div className="dash__grade">
        <section className="dash__col"><div className="painel"><span className="esq" style={{ height: 150 }} /></div></section>
        <section className="dash__col"><div className="painel"><span className="esq" style={{ height: 150 }} /></div></section>
      </div>
    </div>
  );
}
