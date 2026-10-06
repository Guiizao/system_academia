import { useMemo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  IconeInicio, IconeAlunos, IconeTreinos, IconeAgenda,
  IconeFinanceiro, IconeConfig, IconeSino, IconeUsuario, IconeSair,
} from './Icones';
import { useSessao, pode } from '../sessao';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { Avisos } from './Avisos';
import { Bonequinho } from './Bonequinho';
import { filtrarNaoVistos } from '../dominio/avisos-vistos';
import { Logo } from './Logo';
import './Shell.css';

export type Tela = 'inicio' | 'alunos' | 'treinos' | 'agenda' | 'financeiro' | 'config';

const ROTULO_PAPEL = { dono: 'Dono', recepcao: 'Recepção', professor: 'Professor' } as const;

const ITENS: Array<{ id: Tela; rotulo: string; Icone: typeof IconeInicio }> = [
  { id: 'inicio',     rotulo: 'Início',     Icone: IconeInicio },
  { id: 'alunos',     rotulo: 'Alunos',     Icone: IconeAlunos },
  { id: 'treinos',    rotulo: 'Treinos',    Icone: IconeTreinos },
  { id: 'agenda',     rotulo: 'Agenda',     Icone: IconeAgenda },
  { id: 'financeiro', rotulo: 'Financeiro', Icone: IconeFinanceiro },
];

/** Detecta a faixa de largura. É o que decide bottom nav vs sidebar. */
export function useLargura() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return { largura: w, movel: w < 768, tablet: w >= 768 && w < 1024, desktop: w >= 1024 };
}

export function Shell({
  tela, aoNavegar, aoAbrirAluno, children,
}: {
  tela: Tela;
  aoNavegar: (t: Tela) => void;
  aoAbrirAluno: (id: number) => void;
  children: React.ReactNode;
}) {
  const { movel, desktop, largura } = useLargura();
  const { usuario, sair } = useSessao();
  const [vendoAvisos, setVendoAvisos] = useState(false);
  // recarrega ao trocar de tela: o numero acompanha o que acabou de ser feito
  const { dados: avisos } = useDados(() => api.avisos(), [tela], { aCadaMs: 60_000 });
  // o contador mostra so o que ainda nao foi visto NESTE aparelho; marcados muda
  // de valor ao confirmar a leitura, so para a tela recontar
  const [marcados, setMarcados] = useState(0);
  const qtd = useMemo(
    () => (avisos ? filtrarNaoVistos(avisos, usuario.id).length : 0),
    [avisos, usuario.id, marcados],
  );
  const contador = qtd > 0 ? <span className="contador">{qtd > 99 ? '99+' : qtd}</span> : null;
  const nomePartes = ['DARK', 'FISIC'];
  // professor nao lida com dinheiro: aba some. Recepcao ve a aba (recebe pagamentos),
  // mas nao os numeros consolidados -- esses o servidor nem envia para ela.
  const itens = ITENS.filter((i) => i.id !== 'financeiro' || pode.receberPagamento(usuario));

  // fundo do item ativo desliza ate a tela escolhida (medido, porque o rodape
  // do menu fica colado embaixo e muda de posicao com a altura da janela)
  const menusRef = useRef<HTMLDivElement>(null);
  const [indicador, setIndicador] = useState<{ top: number; h: number } | null>(null);
  const [animarIndicador, setAnimarIndicador] = useState(false);
  useLayoutEffect(() => {
    const el = menusRef.current?.querySelector<HTMLElement>('.sidebar__item.on');
    setIndicador(el ? { top: el.offsetTop, h: el.offsetHeight } : null);
  }, [tela, largura, movel, itens.length]);
  useEffect(() => {
    // primeira posicao sem animar: o indicador nao "voa" do topo ao abrir o app
    const id = requestAnimationFrame(() => setAnimarIndicador(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const iniciaisUsuario = usuario.nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  return (
    <div className={`shell ${movel ? 'shell--movel' : desktop ? 'shell--desktop' : 'shell--tablet'}`}>
      {!movel && (
        <aside className="sidebar">
          <button className="marca" onClick={() => aoNavegar('inicio')} aria-label="Início">
            <Logo />
            <span className="marca__nome">{nomePartes[0]} <b>{nomePartes.slice(1).join(' ')}</b></span>
          </button>

          <div className="sidebar__menus" ref={menusRef}>
            {indicador && (
              <span className={`sidebar__indicador ${animarIndicador ? 'anima' : ''}`}
                    style={{ transform: `translateY(${indicador.top}px)`, height: indicador.h }} aria-hidden="true" />
            )}
            <nav className="sidebar__nav">
              {itens.map(({ id, rotulo, Icone }) => (
                <button key={id} className={`sidebar__item ${tela === id ? 'on' : ''}`}
                        onClick={() => aoNavegar(id)} title={rotulo}>
                  <Icone size={19} />
                  {desktop && <span>{rotulo}</span>}
                </button>
              ))}
            </nav>

            <div className="sidebar__rodape">
              <button className="sidebar__item" onClick={() => setVendoAvisos(true)} title="Avisos">
                <IconeSino size={19} />
                {desktop && <span>Avisos</span>}
                {qtd > 0 && <span className="contador sidebar__contador">{qtd > 99 ? '99+' : qtd}</span>}
              </button>
              <button className={`sidebar__item ${tela === 'config' ? 'on' : ''}`}
                      onClick={() => aoNavegar('config')} title="Configurações">
                <IconeConfig size={19} />
                {desktop && <span>Configurações</span>}
              </button>
              <button className="sidebar__item" onClick={sair} title="Sair">
                <IconeSair size={19} />
                {desktop && <span>Sair</span>}
              </button>
            </div>
          </div>

          <div className="sidebar__usuario">
            <div className="avatar sm">{iniciaisUsuario || <IconeUsuario size={15} />}</div>
            {desktop && (
              <div className="sidebar__usuario-info">
                <strong>{usuario.nome}</strong>
                <small>{ROTULO_PAPEL[usuario.papel]}{usuario.cref ? `, CREF ${usuario.cref}` : ''}</small>
              </div>
            )}
          </div>
        </aside>
      )}

      <div className="shell__principal">
        {movel && (
          <header className="topbar">
            <button className="marca" onClick={() => aoNavegar('inicio')} aria-label="Início">
              <Logo />
              <span className="marca__nome">{nomePartes[0]} <b>{nomePartes.slice(1).join(' ')}</b></span>
            </button>
            <div className="topbar__acoes">
              <button className="icone-btn" title="Avisos" aria-label={`Avisos: ${qtd}`} onClick={() => setVendoAvisos(true)}>
                <IconeSino size={17} />{contador}
              </button>
              <button className="icone-btn" onClick={() => aoNavegar('config')} title="Configurações">
                <IconeConfig size={17} />
              </button>
            </div>
          </header>
        )}

        {/* canto do treino: so no PC, e so enfeite */}
        {desktop && <div className="shell__boneco"><Bonequinho /></div>}
        <main className="conteudo">{children}</main>
      </div>

      {vendoAvisos && avisos && (
        <Avisos avisos={avisos} aoFechar={() => setVendoAvisos(false)}
                aoMarcar={() => setMarcados((n) => n + 1)}
                aoAbrirAluno={(id) => { setVendoAvisos(false); aoAbrirAluno(id); }} />
      )}

      {movel && (
        <nav className="bottomnav">
          {itens.map(({ id, rotulo, Icone }) => (
            <button
              key={id}
              className={`bottomnav__item ${tela === id ? 'on' : ''}`}
              onClick={() => aoNavegar(id)}
            >
              <span className="bottomnav__icone"><Icone size={20} /></span>
              <span>{rotulo}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
