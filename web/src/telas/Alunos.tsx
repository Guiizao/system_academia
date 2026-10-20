import { useEffect, useRef, useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao } from '../sessao';
import type { Aluno, StatusAluno } from '../tipos';
import { iniciais, avisoStatus, ROTULO_OBJETIVO, ROTULO_STATUS } from '../dominio';
import { useLargura } from '../componentes/Shell';
import { Modal } from '../componentes/Modal';
import { SeloStatus, ConfirmarInativo } from '../componentes/Inativar';
import { IconeBusca, IconeMais, IconeCheck } from '../componentes/Icones';
import { PerfilAluno } from './PerfilAluno';
import { FormAluno } from './FormAluno';
import { FormPagamento } from './FormPagamento';
import './Alunos.css';

const FILTROS: Array<{ id: StatusAluno | 'todos'; rotulo: string }> = [
  { id: 'todos', rotulo: 'Todos' }, { id: 'ativo', rotulo: 'Ativos' },
  { id: 'vencendo', rotulo: 'A vencer' }, { id: 'vencido', rotulo: 'Vencidos' },
  { id: 'inativo', rotulo: 'Inativos' },
];

/** Espera o usuario parar de digitar antes de buscar. */
function useAtrasado<T>(valor: T, ms = 250) {
  const [v, setV] = useState(valor);
  useEffect(() => { const t = setTimeout(() => setV(valor), ms); return () => clearTimeout(t); }, [valor, ms]);
  return v;
}

/** O que o atalho do Início pediu: abrir o cadastro ou ir para a busca do check-in. */
export type AcaoAlunos = 'novo' | 'checkin';

export function Alunos({ focoId, acao }: {
  focoId?: number | null;
  /** `vez` muda a cada clique: o mesmo atalho duas vezes seguidas funciona as duas */
  acao?: { tipo: AcaoAlunos; vez: number } | null;
}) {
  const { desktop } = useLargura();
  const { avisar } = useSessao();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<StatusAluno | 'todos'>('todos');
  const [selecionado, setSelecionado] = useState<number | null>(focoId ?? null);
  const [indice, setIndice] = useState(0);
  const [modal, setModal] = useState<'novo' | 'pagamento' | null>(null);
  const [inativando, setInativando] = useState<Aluno | null>(null);
  // linha que acabou de receber check-in: acende por um instante
  const [confirmado, setConfirmado] = useState<number | null>(null);
  const confirmar = (id: number) => { setConfirmado(id); window.setTimeout(() => setConfirmado((c) => (c === id ? null : c)), 1400); };
  const buscaRef = useRef<HTMLInputElement>(null);
  const buscaAtrasada = useAtrasado(busca);

  const { dados, carregando, erro, recarregar } = useDados(
    () => api.alunos({ busca: buscaAtrasada, status: filtro }), [buscaAtrasada, filtro]);
  const lista = dados ?? [];

  useEffect(() => { setIndice(0); }, [buscaAtrasada, filtro]);
  useEffect(() => {
    if (acao?.tipo === 'novo') setModal('novo');
    if (acao?.tipo === 'checkin') { setBusca(''); buscaRef.current?.focus(); }
  }, [acao?.vez]);
  // aberto a partir de um aviso ou do painel: seleciona aquele aluno
  useEffect(() => { if (focoId) setSelecionado(focoId); }, [focoId]);
  useEffect(() => {
    if (desktop && lista.length && (selecionado === null || !lista.some((a) => a.id === selecionado))) {
      // indice junto: senão o destaque e o Enter ficam num aluno e a ficha em outro
      setSelecionado(lista[0].id); setIndice(0);
    }
  }, [desktop, lista, selecionado]);

  const detalhe = lista.find((a) => a.id === selecionado) ?? null;

  // Atalhos: o que faz a recepcao rapida no horario de pico.
  useEffect(() => {
    async function onKey(e: KeyboardEvent) {
      // qualquer janela aberta, desta tela ou do perfil: o Enter dela não pode virar check-in
      if (modal || document.documentElement.classList.contains('modal-aberto')) return;
      const emCampo = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '');
      if (e.key === '/' && !emCampo) { e.preventDefault(); buscaRef.current?.focus(); return; }
      if (e.key === 'Escape') { buscaRef.current?.blur(); return; }
      if (!lista.length || !desktop) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = Math.max(0, Math.min(lista.length - 1, indice + (e.key === 'ArrowDown' ? 1 : -1)));
        setIndice(n); setSelecionado(lista[n].id);
      }
      // Enter no selo Vencido ou num botão da ficha é daquele botão; no resto
      // (busca, linhas, filtros, menu) continua sendo o check-in do destacado
      if (e.key === 'Enter' && (document.activeElement as HTMLElement | null)?.matches('.badge--acao, .perfil button')) return;
      if (e.key === 'Enter' && lista[indice]) {
        e.preventDefault();
        const a = lista[indice];
        try {
          await api.registrarCheckin(a.id, 'Musculação');
          confirmar(a.id);
          const aviso = avisoStatus(a.status, a.diasParaVencer);
          avisar(`Check-in de ${a.nome.split(' ')[0]}${aviso && a.status !== 'ativo' ? ` - ${aviso}` : ''}`,
                 // sem bloqueio (decisao do dono), entao a tela precisa gritar (spec 5.3)
                 a.status === 'vencido' || a.status === 'inativo' ? 'erro' : 'ok');
          recarregar();
        } catch (err: any) { avisar(err.message, 'erro'); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lista, indice, desktop, modal, avisar, recarregar]);

  const painelLista = (
    <>
      <div className="sec-head">
        <h2>Alunos</h2>
        <span className="sec-sub">{carregando ? '...' : `${lista.length} ${lista.length === 1 ? 'aluno' : 'alunos'}`}</span>
      </div>
      <div className="busca">
        <IconeBusca size={17} />
        <input ref={buscaRef} value={busca} onChange={(e) => setBusca(e.target.value)}
               placeholder="Buscar por nome ou telefone" aria-label="Buscar aluno" />
        {!busca && <kbd className="busca__atalho">/</kbd>}
      </div>
      <div className="chips alunos__chips">
        {FILTROS.map((f) => (
          <button key={f.id} className={`chip ${filtro === f.id ? 'on' : ''}`} onClick={() => setFiltro(f.id)}>{f.rotulo}</button>
        ))}
      </div>
      {desktop && (
        <div className="dica-teclado">
          <kbd>&uarr;</kbd><kbd>&darr;</kbd> escolhe, <kbd>Enter</kbd> faz check-in
          <button className="link-btn" onClick={() => setModal('novo')}>Novo aluno</button>
        </div>
      )}
      <div className="alunos__lista escalonar">
        {erro && <div className="erro-carga">{erro}</div>}
        {!carregando && !erro && lista.length === 0 && (
          <div className="vazio"><strong>Nenhum aluno encontrado</strong>Ajuste a busca ou o filtro.</div>
        )}
        {lista.map((a, i) => (
          // a linha inteira abre o aluno (o ::after do botão cobre tudo); o selo
          // "Vencido" fica por cima, como um segundo botão, sem botão dentro de botão
          <div key={a.id}
               className={`aluno-item ${selecionado === a.id ? 'sel' : ''} ${i === indice && desktop ? 'foco' : ''} ${confirmado === a.id ? 'confirmado' : ''}`}>
            {/* Tab chegando na linha também a destaca: o Enter vai para quem está com o foco */}
            <button type="button" className="aluno-item__abrir" onClick={() => { setSelecionado(a.id); setIndice(i); }}
                    onFocus={() => { if (desktop) { setSelecionado(a.id); setIndice(i); } }}>
              <div className="avatar">{iniciais(a.nome)}</div>
              {confirmado === a.id && <span className="visto" aria-label="Check-in registrado"><IconeCheck size={11} /></span>}
              <div className="aluno-item__info">
                <div className="aluno-item__nome">{a.nome}</div>
                <div className="aluno-item__meta">
                  {a.planoNome ?? 'Sem plano'}
                  {a.ultimaAvaliacao?.objetivo && `, ${ROTULO_OBJETIVO[a.ultimaAvaliacao.objetivo].toLowerCase()}`}
                </div>
              </div>
              {/* o status mora fora do botão (o selo é outro botão): o leitor de tela lê aqui */}
              <span className="so-leitor">{`, ${ROTULO_STATUS[a.status]}${avisoStatus(a.status, a.diasParaVencer) ? `, ${avisoStatus(a.status, a.diasParaVencer)}` : ''}`}</span>
            </button>
            <div className="aluno-item__dir">
              <SeloStatus aluno={a} aoInativar={() => setInativando(a)} />
              {(a.status === 'vencido' || a.status === 'vencendo') && (
                <div className={`aluno-item__aviso ${a.status === 'vencido' ? 'grave' : ''}`}>
                  {avisoStatus(a.status, a.diasParaVencer)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  const perfil = detalhe && (
    <PerfilAluno aluno={detalhe} aoMudar={recarregar} aoPagar={() => setModal('pagamento')} aoCheckin={confirmar} />
  );

  const modais = (
    <>
      {modal === 'novo' && (
        <FormAluno aoFechar={() => setModal(null)}
                   aoCriar={(id) => { setModal(null); setBusca(''); setFiltro('todos'); setSelecionado(id); recarregar(); }} />
      )}
      {inativando && (
        // fechar também recarrega: se outro aparelho mudou o aluno, a linha se corrige
        <ConfirmarInativo aluno={inativando} aoFechar={() => { setInativando(null); recarregar(); }}
                          aoInativar={() => { setInativando(null); recarregar(); }} />
      )}
      {modal === 'pagamento' && detalhe && (
        <FormPagamento aluno={detalhe} aoFechar={() => setModal(null)}
                       aoPagar={() => { setModal(null); recarregar(); }} />
      )}
    </>
  );

  if (!desktop) {
    return (
      <div className="entrar">
        {painelLista}
        {detalhe && selecionado !== null && modal === null && !inativando && (
          <Modal titulo={detalhe.nome} aoFechar={() => setSelecionado(null)} largo ocultarTitulo>{perfil}</Modal>
        )}
        <button className="fab" onClick={() => setModal('novo')} aria-label="Novo aluno"><IconeMais size={22} /></button>
        {modais}
      </div>
    );
  }

  return (
    <div className="mestre-detalhe">
      <div className="mestre-detalhe__lista">{painelLista}</div>
      <div className="mestre-detalhe__detalhe">
        {perfil ?? <div className="vazio" style={{ paddingTop: 90 }}><strong>Selecione um aluno</strong></div>}
      </div>
      {modais}
    </div>
  );
}
