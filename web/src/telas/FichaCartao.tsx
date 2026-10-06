import { useState } from 'react';
import { api } from '../dados/api';
import { useSessao } from '../sessao';
import type { FichaTreino } from '../tipos';
import { formatarData } from '../dominio';
import { IconeAlerta, IconeCheck } from '../componentes/Icones';

const OBJ: Record<string, string> = {
  hipertrofia: 'Hipertrofia', emagrecimento: 'Emagrecimento', definicao: 'Definição',
  condicionamento: 'Condicionamento', saude_geral: 'Saúde geral', reabilitacao: 'Reabilitação',
};

export function FichaCartao({ ficha: f, alunoNome, aoMudar }: {
  ficha: FichaTreino; alunoNome?: string; aoMudar: () => void;
}) {
  const { usuario, avisar } = useSessao();
  const [liberando, setLiberando] = useState(false);

  // Bug #2 corrigido: libera como QUEM ESTA LOGADO. Nao existe "liberar como fulano".
  async function liberar() {
    setLiberando(true);
    try {
      await api.aprovarFicha(f.id);
      avisar('Ficha liberada para o aluno', 'ok');
      aoMudar();
    } catch (e: any) { avisar(e.message, 'erro'); }
    finally { setLiberando(false); }
  }

  const semCref = !usuario.cref?.trim();

  return (
    <div className="ficha">
      <div className="ficha__cab">
        <div>
          <strong>{alunoNome ?? OBJ[f.objetivo] ?? f.objetivo}</strong>
          <small>
            {alunoNome ? `${OBJ[f.objetivo] ?? f.objetivo}, ` : ''}{f.diasPorSemana}x por semana.
            {' '}Criada em {formatarData(f.criadoEm.slice(0, 10))}{f.geradaPor === 'ia' ? ', gerada por IA' : ''}.
          </small>
        </div>
        <span className={`badge ${f.status === 'aprovada' ? 'b-ok' : 'b-warn'}`}>
          {f.status === 'aprovada' ? 'Liberada' : 'Rascunho'}
        </span>
      </div>

      {f.status === 'rascunho' ? (
        <>
          <div className="ficha__gate">
            <IconeAlerta size={14} /><span>Rascunho: o aluno só recebe depois que alguém do treino revisar e liberar.</span>
          </div>
          <div className="ficha__liberar">
            {/* aviso, nao bloqueio: a decisao de liberar sem CREF e de quem responde pela academia */}
            {semCref && (
              <p className="ficha__sem-cref">
                Você está sem CREF cadastrado. Prescrever exercício é atividade de profissional de
                Educação Física (Lei 9.696/1998). Dá para liberar assim mesmo, e a ficha fica
                registrada como liberada sem CREF.
              </p>
            )}
            <button className="btn btn-primary btn-bloco" onClick={liberar} disabled={liberando}>
              {liberando ? <><span className="giro" />Liberando</> : <><IconeCheck size={15} />
                {semCref
                  ? `Revisei, liberar como ${usuario.nome.split(' ')[0]}`
                  : `Revisei, liberar como ${usuario.nome.split(' ')[0]} (CREF ${usuario.cref})`}</>}
            </button>
          </div>
        </>
      ) : (
        <div className={`ficha__assinada ${f.aprovadaCref ? '' : 'ficha__assinada--sem-cref'}`}>
          {f.aprovadaCref ? <IconeCheck size={13} /> : <IconeAlerta size={13} />}
          <span>
            Liberada por {f.aprovadaPorNome}{f.aprovadaCref ? ` (CREF ${f.aprovadaCref})` : ', sem CREF registrado'}
            {f.aprovadaEm && ` em ${formatarData(f.aprovadaEm.slice(0, 10))}`}
          </span>
        </div>
      )}

      {f.divisoes.map((d) => (
        <div key={d.id} className="divisao">
          <div className="divisao__cab">Treino {d.rotulo}<small>{d.foco}</small></div>
          {d.itens.map((it) => (
            <div key={it.ordem} className="exercicio">
              <span className="exercicio__num">{it.ordem}</span>
              <div className="exercicio__info">
                <div className="exercicio__nome">{it.exercicioNome}</div>
                <div className="exercicio__det">
                  {it.series} x {it.reps}, {it.descansoSeg}s de descanso
                  {it.cargaOrientacao && `. ${it.cargaOrientacao}`}
                </div>
              </div>
              <span className="exercicio__maq">{it.equipamento}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
