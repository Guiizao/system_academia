import { useLayoutEffect, useRef, useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao, pode } from '../sessao';
import type { Aluno } from '../tipos';
import {
  iniciais, formatarTelefone, formatarBRL, formatarData, tempoRelativo,
  calcularIMC, categoriaIMC, CLASSE_STATUS, ROTULO_STATUS, avisoStatus, ROTULO_NIVEL,
} from '../dominio';
import { estadoDoCheckin } from '../dominio/checkin';
import { IconeCheckin, IconeAlerta, IconeFinanceiro, IconeCheck } from '../componentes/Icones';
import { FichaCartao } from './FichaCartao';
import { FormAvaliacao } from './FormAvaliacao';
import { FormEditarAluno } from './FormEditarAluno';
import { FormFicha } from './FormFicha';

const ABAS = ['Medidas', 'Treino', 'Pagamentos', 'Histórico'] as const;

export function PerfilAluno({ aluno, aoMudar, aoPagar, aoCheckin }: {
  aluno: Aluno; aoMudar: () => void; aoPagar: () => void; aoCheckin?: (id: number) => void;
}) {
  const { usuario, avisar } = useSessao();
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Medidas');
  const [registrando, setRegistrando] = useState(false);
  const [registrado, setRegistrado] = useState(false);
  const [modal, setModal] = useState<'editar' | 'avaliacao' | 'ficha' | null>(null);
  const [versao, setVersao] = useState(0);
  const fechouSalvando = () => { setModal(null); setVersao((x) => x + 1); aoMudar(); };
  const podeTreino = usuario.papel !== 'recepcao';
  const av = aluno.ultimaAvaliacao;
  const imc = calcularIMC(av?.pesoKg ?? undefined, av?.alturaM ?? undefined);
  const aviso = avisoStatus(aluno.status, aluno.diasParaVencer);
  const abas = ABAS.filter((a) => a !== 'Pagamentos' || pode.receberPagamento(usuario));

  // sublinhado da aba ativa desliza ate a aba escolhida
  const abasRef = useRef<HTMLDivElement>(null);
  const [marca, setMarca] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = abasRef.current?.querySelector<HTMLElement>('.aba.on');
    if (el) setMarca({ x: el.offsetLeft, w: el.offsetWidth });
  }, [aba, abas.length]);

  // uma entrada por hora: o botao espera junto com o servidor, em vez de
  // deixar a recepcao apertar e receber recusa
  const entrada = estadoDoCheckin(aluno.ultimoCheckinEm);

  // Bug #4 corrigido: o botao REGISTRA no servidor antes de dizer que registrou.
  async function checkin() {
    setRegistrando(true);
    try {
      await api.registrarCheckin(aluno.id, 'Musculação');
      setRegistrado(true); window.setTimeout(() => setRegistrado(false), 1600);
      aoCheckin?.(aluno.id);
      // sem bloqueio (decisao do dono), entao a tela precisa gritar (spec 5.3)
      const grave = aluno.status === 'vencido' || aluno.status === 'inativo';
      avisar(`Check-in de ${aluno.nome.split(' ')[0]} registrado${grave && aviso ? ` - ${aviso}` : ''}`, grave ? 'erro' : 'ok');
      aoMudar();
    } catch (e: any) { avisar(e.message, 'erro'); }
    finally { setRegistrando(false); }
  }

  return (
    <div className="perfil entrar" key={aluno.id}>
      <div className="perfil__topo">
        <div className="avatar lg">{iniciais(aluno.nome)}</div>
        <div className="perfil__id">
          <h2>{aluno.nome}</h2>
          <p>{aluno.planoNome ?? 'Sem plano'}, {formatarTelefone(aluno.telefone)}</p>
          <div className="perfil__selos">
            <span className={`badge ${CLASSE_STATUS[aluno.status]}`}>{ROTULO_STATUS[aluno.status]}</span>
            {av?.nivel && <span className="badge b-blue">{ROTULO_NIVEL[av.nivel]}</span>}
            {aluno.matricula && <span className="badge b-mudo">Vence {formatarData(aluno.matricula.dataFim)}</span>}
            <span className="badge b-mudo">{aluno.checkinsNoMes} check-ins no mês</span>
          </div>
        </div>
        <div className="perfil__acoes">
          <button className={`btn btn-sm ${registrado ? 'btn-ok' : 'btn-primary'}`} onClick={checkin}
                  disabled={registrando || registrado || !entrada.liberado} title={entrada.titulo}>
            {registrado ? <><IconeCheck size={14} />Registrado</>
              : registrando ? <><span className="giro" />Registrando</>
              : <><IconeCheckin size={14} />{entrada.rotulo}</>}
          </button>
          {pode.receberPagamento(usuario) && (
            <button className="btn btn-secondary btn-sm" onClick={aoPagar}>
              <IconeFinanceiro size={14} />Pagamento
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setModal('editar')}>Editar</button>
        </div>
      </div>

      {aviso && aluno.status !== 'ativo' && (
        <div className={`perfil__faixa ${aluno.status === 'vencido' ? 'grave' : ''}`}>
          <IconeAlerta size={15} />{aviso}
          {aluno.status === 'vencido' && '. O check-in continua liberado, mas há cobrança em aberto.'}
        </div>
      )}

      {aluno.restricoes.length > 0 && (
        <div className="perfil__restricoes">
          <div className="perfil__restricoes-cab"><IconeAlerta size={14} />Restrições médicas</div>
          <div className="perfil__tags">
            {aluno.restricoes.map((r) => <span key={r} className="tag-restricao">{r}</span>)}
          </div>
          {aluno.observacoesMedicas && <p>{aluno.observacoesMedicas}</p>}
          <small>Exercícios contraindicados para estas tags nunca entram numa ficha deste aluno.</small>
        </div>
      )}

      <div className="abas" role="tablist" ref={abasRef}>
        {abas.map((a) => (
          <button key={a} role="tab" aria-selected={aba === a}
                  className={`aba ${aba === a ? 'on' : ''}`} onClick={() => setAba(a)}>{a}</button>
        ))}
        {marca && <span className="abas__marca" style={{ transform: `translateX(${marca.x}px)`, width: marca.w }} aria-hidden="true" />}
      </div>

      <div className="perfil__corpo" key={aba}>
        {aba === 'Medidas' && <>
          <button className="btn btn-secondary btn-sm acao-aba" onClick={() => setModal('avaliacao')}>Nova avaliação</button>
          <AbaMedidas key={versao} alunoId={aluno.id} imc={imc} />
        </>}
        {aba === 'Treino' && <>
          {podeTreino && <button className="btn btn-secondary btn-sm acao-aba" onClick={() => setModal('ficha')}>Montar ficha</button>}
          <AbaTreino key={versao} alunoId={aluno.id} />
        </>}
        {aba === 'Pagamentos' && <AbaPagamentos alunoId={aluno.id} />}
        {aba === 'Histórico' && <AbaHistorico alunoId={aluno.id} />}
      </div>

      {modal === 'editar' && <FormEditarAluno aluno={aluno} aoFechar={() => setModal(null)} aoSalvar={fechouSalvando} />}
      {modal === 'avaliacao' && <FormAvaliacao aluno={aluno} aoFechar={() => setModal(null)} aoSalvar={fechouSalvando} />}
      {modal === 'ficha' && <FormFicha alunoInicial={aluno.id} aoFechar={() => setModal(null)} aoCriar={fechouSalvando} />}
    </div>
  );
}

function Medida({ v, u, r }: { v: number | null | undefined; u: string; r: string }) {
  return (
    <div className="medida">
      <div><span className="medida__v">{v ?? '—'}</span>{v != null && u && <span className="medida__u">{u}</span>}</div>
      <span className="medida__r">{r}</span>
    </div>
  );
}

function AbaMedidas({ alunoId, imc }: { alunoId: number; imc: number | null }) {
  const { dados, carregando } = useDados(() => api.avaliacoes(alunoId), [alunoId]);
  if (carregando) return <EsqueletoLinhas />;
  const av = dados?.[0];
  if (!av) return <div className="vazio"><strong>Sem avaliação</strong>Nenhuma avaliação física registrada.</div>;
  return (
    <>
      <div className="medidas">
        <Medida v={av.pesoKg} u="kg" r="Peso" />
        <Medida v={av.alturaM} u="m" r="Altura" />
        <Medida v={imc} u="" r={`IMC, ${categoriaIMC(imc).toLowerCase()}`} />
        <Medida v={av.percGordura} u="%" r="Gordura" />
        <Medida v={av.circBraco} u="cm" r="Braço" />
        <Medida v={av.circPeito} u="cm" r="Peito" />
        <Medida v={av.circCintura} u="cm" r="Cintura" />
        <Medida v={av.circQuadril} u="cm" r="Quadril" />
      </div>
      <div className="hist-avaliacoes">
        <div className="sec-head"><h2 style={{ fontSize: 14 }}>Evolução</h2></div>
        {dados!.map((a) => (
          <div key={a.id} className="hist-linha">
            <span>{formatarData(a.data)}</span>
            <span>{a.pesoKg} kg</span>
            <span>{a.percGordura}% gordura</span>
            <span>{a.circCintura} cm cintura</span>
          </div>
        ))}
        {dados!.length < 2 && <p className="nota">A evolução aparece a partir da segunda avaliação.</p>}
      </div>
    </>
  );
}

function AbaTreino({ alunoId }: { alunoId: number }) {
  const { dados, carregando, recarregar } = useDados(() => api.fichasDoAluno(alunoId), [alunoId]);
  if (carregando) return <EsqueletoLinhas />;
  if (!dados?.length) return <div className="vazio"><strong>Nenhuma ficha</strong>Use "Montar ficha" para criar a primeira.</div>;
  return <>{dados.map((f) => <FichaCartao key={f.id} ficha={f} aoMudar={recarregar} />)}</>;
}

function AbaPagamentos({ alunoId }: { alunoId: number }) {
  const { dados, carregando } = useDados(() => api.pagamentosDoAluno(alunoId), [alunoId]);
  if (carregando) return <EsqueletoLinhas />;
  if (!dados?.length) return <div className="vazio">Sem pagamentos registrados.</div>;
  return (
    <div className="tabela">
      {dados.map((p) => (
        <div key={p.id} className="tabela__linha">
          <div>
            <div className="tabela__forte">{p.observacao ?? 'Pagamento'}</div>
            <div className="tabela__fraco">{formatarData(p.dataPagamento)}, {ROTULO_FORMA[p.forma] ?? p.forma}</div>
          </div>
          <strong className="valor-ok">{formatarBRL(p.valorCentavos)}</strong>
        </div>
      ))}
    </div>
  );
}

function AbaHistorico({ alunoId }: { alunoId: number }) {
  const { dados, carregando } = useDados(() => api.checkinsDoAluno(alunoId), [alunoId]);
  if (carregando) return <EsqueletoLinhas />;
  if (!dados?.length) return <div className="vazio">Nenhum check-in registrado.</div>;
  return (
    <div className="tabela">
      {dados.map((c) => (
        <div key={c.id} className="tabela__linha">
          <div>
            <div className="tabela__forte">{c.atividade}</div>
            <div className="tabela__fraco">{tempoRelativo(c.dataHora)}</div>
          </div>
          <span className="tabela__fraco">
            {formatarData(c.dataLocal)}, {new Date(c.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
          </span>
        </div>
      ))}
    </div>
  );
}

const ROTULO_FORMA: Record<string, string> = { pix: 'Pix', dinheiro: 'dinheiro', debito: 'débito', credito: 'crédito', boleto: 'boleto' };

function EsqueletoLinhas() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      {[0, 1, 2].map((i) => <span key={i} className="esq" style={{ height: 44, marginBottom: 8 }} />)}
    </div>
  );
}
