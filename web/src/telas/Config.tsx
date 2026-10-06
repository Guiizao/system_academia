import { useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao } from '../sessao';
import { FormMembro, FormSenha } from './FormEquipe';
import { FormAcademia } from './FormAcademia';
import type { Membro } from '../tipos';
import { lerTema, salvarTema, type PrefTema } from '../tema';
import { lerEfeitos, salvarEfeitos } from '../efeitos';
import { EFEITOS, alternar, type IdEfeito } from '../dominio/efeitos';
import { TEMAS } from '../dominio/temas';
import './Config.css';

const ROTULO_PAPEL = { dono: 'Dono', recepcao: 'Recepção', professor: 'Professor' } as const;

export function Config() {
  const { usuario, sair } = useSessao();
  const dono = usuario.papel === 'dono';
  const { dados: cfg, recarregar: recCfg } = useDados(() => api.config(), []);
  const { dados: equipe, recarregar } = useDados(() => (dono ? api.equipe() : Promise.resolve([] as Membro[])), [dono]);
  const { dados: status } = useDados(() => fetch('/status').then((r) => r.json()), []);
  const [modal, setModal] = useState<'senha' | 'novo' | 'academia' | Membro | null>(null);
  const [tema, setTema] = useState<PrefTema>(lerTema);
  const [efeitos, setEfeitos] = useState<IdEfeito[]>(lerEfeitos);

  return (
    <div className="container entrar config">
      <div className="sec-head"><h2>Configurações</h2></div>

      <section className="bloco">
        <h3>Você</h3>
        <div className="bloco__linha">
          <div><strong>{usuario.nome}</strong><small>{usuario.email}, {ROTULO_PAPEL[usuario.papel].toLowerCase()}{usuario.cref ? `, CREF ${usuario.cref}` : ''}</small></div>
          <div className="bloco__acoes">
            <button className="btn btn-secondary btn-sm" onClick={() => setModal('senha')}>Trocar senha</button>
            <button className="btn btn-danger btn-sm" onClick={sair}>Sair</button>
          </div>
        </div>
        <div className="bloco__linha bloco__linha--coluna">
          <div><strong>Aparência</strong><small>Vale só para este aparelho. Use as setas do teclado para comparar.</small></div>
          <SeletorTema valor={tema} aoMudar={(t) => { setTema(t); salvarTema(t); }} />
        </div>
        <div className="bloco__linha bloco__linha--coluna">
          <div>
            <strong>Efeitos</strong>
            <small>
              Cinco extras que você liga e desliga. Valem só para este aparelho, e o sistema
              funciona igual com todos desligados.
            </small>
          </div>
          <SeletorEfeitos
            ligados={efeitos}
            aoMudar={(id) => {
              const novos = alternar(efeitos, id);
              setEfeitos(novos);
              salvarEfeitos(novos);
            }}
          />
        </div>
      </section>

      {dono && (
        <section className="bloco">
          <div className="bloco__cab">
            <h3>Equipe</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setModal('novo')}>Cadastrar pessoa</button>
          </div>
          <p className="bloco__nota">Donos, recepção e professores. Cada pessoa entra com o próprio e-mail e senha.</p>
          {equipe?.map((m) => (
            <button key={m.id} className="bloco__linha bloco__linha--clique" onClick={() => setModal(m)}>
              <div>
                <strong>{m.nome}{m.id === usuario.id && ' (você)'}</strong>
                <small>{m.email}{m.cref ? `, CREF ${m.cref}` : ''}</small>
              </div>
              <div className="bloco__acoes">
                {!m.ativo && <span className="badge b-danger">Bloqueado</span>}
                <span className={`badge ${m.papel === 'dono' ? 'b-blue' : m.papel === 'professor' ? 'b-ok' : 'b-mudo'}`}>{ROTULO_PAPEL[m.papel]}</span>
              </div>
            </button>
          ))}
        </section>
      )}

      {cfg && (
        <section className="bloco">
          <div className="bloco__cab">
            <h3>Academia</h3>
            {dono && <button className="btn btn-secondary btn-sm" onClick={() => setModal('academia')}>Editar dados e Pix</button>}
          </div>
          <Linha rotulo="Nome" valor={cfg.academia.nome} />
          <Linha rotulo="Chave Pix" valor={cfg.academia.pixChave ?? 'não configurada: sem ela o sistema não gera Pix'} />
          <Linha rotulo="Aviso de vencimento" valor={`${cfg.academia.diasAvisoVencimento} dias antes`} />
          <Linha rotulo="Aluno sumido após" valor={`${cfg.academia.diasAlunoSumido} dias sem check-in`} />
        </section>
      )}

      <section className="bloco">
        <h3>Recursos desligados por enquanto</h3>
        <Recurso nome="Cobrança pelo WhatsApp"
          texto="Aviso de vencimento, cobrança e envio do Pix direto no WhatsApp do aluno. Os alunos que aceitaram já estão marcados no cadastro." />
        <Recurso nome="Ficha de treino por IA"
          texto="Rascunho gerado a partir das medidas e restrições, sempre revisado por um professor com CREF antes de chegar ao aluno." />
      </section>

      {status && (
        <section className="bloco">
          <h3>Servidor</h3>
          <Linha rotulo="Versão" valor={status.versao} />
          <Linha rotulo="No ar desde" valor={new Date(status.iniciadoEm).toLocaleString('pt-BR')} />
          <Linha rotulo="Banco de dados" valor={status.banco} />
        </section>
      )}

      {modal === 'senha' && <FormSenha aoFechar={() => setModal(null)} />}
      {modal === 'academia' && <FormAcademia aoFechar={() => setModal(null)} aoSalvar={() => { setModal(null); recCfg(); }} />}
      {modal === 'novo' && <FormMembro aoFechar={() => setModal(null)} aoSalvar={() => { setModal(null); recarregar(); }} />}
      {modal && typeof modal === 'object' && (
        <FormMembro membro={modal} aoFechar={() => setModal(null)} aoSalvar={() => { setModal(null); recarregar(); }} />
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="bloco__linha"><span className="bloco__rot">{rotulo}</span><span>{valor}</span></div>;
}

function Recurso({ nome, texto }: { nome: string; texto: string }) {
  return (
    <div className="recurso">
      <div><strong>{nome}</strong><small>{texto}</small></div>
      <span className="interruptor" role="switch" aria-checked="false" aria-disabled="true" title="Desligado por enquanto"><i /></span>
    </div>
  );
}

/**
 * Paletas em amostra: cada cartao pinta com as cores do proprio tema, entao
 * da para escolher olhando, sem precisar aplicar para ver.
 */
function SeletorTema({ valor, aoMudar }: { valor: PrefTema; aoMudar: (v: PrefTema) => void }) {
  function pelasSetas(e: React.KeyboardEvent<HTMLDivElement>) {
    const passo = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!passo) return;
    e.preventDefault();
    const i = TEMAS.findIndex((t) => t.id === valor);
    aoMudar(TEMAS[(i + passo + TEMAS.length) % TEMAS.length].id);
  }
  return (
    <div className="temas" role="radiogroup" aria-label="Tema da interface" onKeyDown={pelasSetas}>
      {TEMAS.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={valor === t.id}
                tabIndex={valor === t.id ? 0 : -1} title={t.descricao}
                className={`tema ${valor === t.id ? 'on' : ''}`} onClick={() => aoMudar(t.id)}>
          <span className="tema__amostra" aria-hidden="true">
            {t.amostra.map((cor, i) => <i key={i} style={{ background: cor }} />)}
          </span>
          <span className="tema__nome">{t.nome}</span>
        </button>
      ))}
    </div>
  );
}


/**
 * Os cinco efeitos opcionais. Interruptor por item, com o nome e a explicacao
 * do lado -- quem le sabe o que vai mudar antes de ligar.
 */
function SeletorEfeitos({ ligados, aoMudar }: {
  ligados: readonly IdEfeito[]; aoMudar: (id: IdEfeito) => void;
}) {
  return (
    <div className="efeitos">
      {EFEITOS.map((e) => {
        const on = ligados.includes(e.id);
        return (
          <button key={e.id} type="button" role="switch" aria-checked={on}
                  className={`efeito ${on ? 'on' : ''}`} onClick={() => aoMudar(e.id)}>
            <span className="efeito__chave" aria-hidden="true"><i /></span>
            <span className="efeito__texto">
              <strong>{e.nome}</strong>
              <small>{e.descricao}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
