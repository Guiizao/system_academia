import { useState } from 'react';
import type { Aviso } from '../tipos';
import { useSessao } from '../sessao';
import { filtrarNaoVistos, marcarTodosComoVistos } from '../dominio/avisos-vistos';
import { Modal } from './Modal';
import './Avisos.css';

const COR: Record<Aviso['tipo'], string> = {
  cobranca: 'danger', vencido: 'danger', vencendo: 'warn', sumido: 'purple', ficha: '',
};

/**
 * Lista do que precisa de acao hoje. Tocar leva ao aluno.
 * "Marcar como visto" tira da contagem sem fingir que o problema acabou: se o
 * aluno continuar vencido amanha, o aviso volta com a situacao nova.
 */
export function Avisos({ avisos, aoFechar, aoAbrirAluno, aoMarcar }: {
  avisos: Aviso[]; aoFechar: () => void; aoAbrirAluno: (id: number) => void; aoMarcar: () => void;
}) {
  const { usuario } = useSessao();
  const [mostrarVistos, setMostrarVistos] = useState(false);
  const naoVistos = filtrarNaoVistos(avisos, usuario.id);
  const lista = mostrarVistos ? avisos : naoVistos;
  const vistos = avisos.length - naoVistos.length;

  function marcarTodos() {
    marcarTodosComoVistos(avisos, usuario.id);
    aoMarcar();
  }

  return (
    <Modal titulo={`Avisos (${naoVistos.length})`} aoFechar={aoFechar}>
      {!avisos.length && (
        <div className="vazio"><strong>Nada pendente</strong>Nenhuma cobrança atrasada, plano vencendo ou ficha esperando.</div>
      )}

      {avisos.length > 0 && (
        <div className="avisos__barra">
          <span>
            {naoVistos.length
              ? `${naoVistos.length} ${naoVistos.length === 1 ? 'aviso novo' : 'avisos novos'}`
              : 'Tudo visto por aqui'}
            {vistos > 0 && <small>, {vistos} já visto{vistos === 1 ? '' : 's'}</small>}
          </span>
          <div className="avisos__acoes">
            {vistos > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setMostrarVistos((v) => !v)}>
                {mostrarVistos ? 'Esconder vistos' : 'Mostrar vistos'}
              </button>
            )}
            {naoVistos.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={marcarTodos}>Marcar como vistos</button>
            )}
          </div>
        </div>
      )}

      {avisos.length > 0 && !lista.length && (
        <div className="vazio">
          <strong>Nenhum aviso novo</strong>
          Os anteriores continuam valendo e voltam se a situação mudar.
        </div>
      )}

      <div className="avisos">
        {lista.map((a, i) => (
          <button key={`${a.tipo}-${a.alunoId}-${i}`} className="aviso-item" disabled={!a.alunoId}
                  style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}
                  onClick={() => a.alunoId && aoAbrirAluno(a.alunoId)}>
            <i className={`ponto ${COR[a.tipo]}`} />
            <span className="aviso-item__titulo">{a.titulo}</span>
            <span className="aviso-item__detalhe">{a.detalhe}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
