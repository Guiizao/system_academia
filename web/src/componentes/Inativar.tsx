import { useState } from 'react';
import { api } from '../dados/api';
import { useSessao, pode } from '../sessao';
import { CLASSE_STATUS, ROTULO_STATUS, avisoStatus } from '../dominio';
import type { Aluno } from '../tipos';
import { Modal } from './Modal';
import { IconeSeta } from './Icones';

/**
 * O selo do status. Vencido vira botão para o dono e a recepção: marca como
 * inativo quem não vai voltar, e a lista de vencidos passa a mostrar só quem
 * ainda deve (pedido do João, 19/10).
 */
export function SeloStatus({ aluno, aoInativar }: { aluno: Aluno; aoInativar: () => void }) {
  const { usuario } = useSessao();
  const classe = `badge ${CLASSE_STATUS[aluno.status]}`;
  if (aluno.status !== 'vencido' || !pode.receberPagamento(usuario)) {
    return <span className={classe}>{ROTULO_STATUS[aluno.status]}</span>;
  }
  return (
    <button type="button" className={`${classe} badge--acao`} onClick={aoInativar}
            aria-haspopup="dialog" title="Marcar como inativo" aria-label={`Vencido. Marcar ${aluno.nome} como inativo`}>
      Vencido<IconeSeta size={11} />
    </button>
  );
}

export function ConfirmarInativo({ aluno, aoFechar, aoInativar }: {
  aluno: Aluno; aoFechar: () => void; aoInativar: () => void;
}) {
  const { avisar } = useSessao();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setEnviando(true); setErro(null);
    try {
      await api.inativarAluno(aluno.id);
      avisar(`${aluno.nome.split(' ')[0]} agora está em Inativos.`, 'ok', { semFesta: true });
      aoInativar();
    } catch (e: any) { setErro(e.message); setEnviando(false); }
  }

  return (
    <Modal titulo="Marcar como inativo" aoFechar={aoFechar}>
      <p className="inativar__quem"><strong>{aluno.nome}</strong>{avisoStatus(aluno.status, aluno.diasParaVencer) && <span>{avisoStatus(aluno.status, aluno.diasParaVencer)}</span>}</p>
      <ul className="inativar__efeitos">
        <li>Sai dos vencidos e vai para o filtro Inativos.</li>
        <li>A cobrança em aberto é cancelada.</li>
        <li>Pagamentos, check-ins e avaliações continuam guardados.</li>
      </ul>
      <p className="form-nota">Se voltar, é só registrar o pagamento: o plano recomeça no dia em que pagar.</p>
      {erro && <div className="form-erro" role="alert">{erro}</div>}
      <div className="linha2">
        {/* o foco começa no Cancelar: um Enter a mais logo depois de abrir não marca ninguém */}
        <button type="button" className="btn btn-secondary" onClick={aoFechar} autoFocus>Cancelar</button>
        <button type="button" className="btn btn-danger" onClick={confirmar} disabled={enviando}>
          {enviando ? <><span className="giro" />Marcando</> : 'Marcar como inativo'}
        </button>
      </div>
    </Modal>
  );
}
