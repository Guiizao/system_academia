import { useState } from 'react';
import { useSessao } from '../sessao';
import { Modal } from '../componentes/Modal';
import { BarrasVerticais, BarrasHorizontais } from '../componentes/Grafico';
import { Olho, useValores } from '../componentes/Valores';
import { mesCurto, variacaoTexto } from '../dominio/grafico';
import { linkGrupoWhatsapp } from '../dominio/whatsapp';
import type { RelatorioMes as Relatorio } from '../tipos';

const ROTULO_FORMA: Record<string, string> = {
  pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito', boleto: 'Boleto',
};

/**
 * Fechamento do mes: os numeros, os graficos e o texto pronto para mandar.
 * O texto e o mesmo que o servidor monta -- tela e WhatsApp nunca divergem.
 */
export function RelatorioMes({ relatorio, aoFechar }: { relatorio: Relatorio; aoFechar: () => void }) {
  // o olho vale para o sistema inteiro: esconder aqui esconde em todas as telas
  const { formatar: dinheiro } = useValores();
  const { avisar } = useSessao();
  const [copiado, setCopiado] = useState(false);
  const variacao = variacaoTexto(relatorio.variacaoPct);

  function copiar() {
    navigator.clipboard?.writeText(relatorio.texto)
      .then(() => { setCopiado(true); window.setTimeout(() => setCopiado(false), 1800); })
      .catch(() => avisar('Não consegui copiar. Selecione o texto e copie à mão.', 'erro'));
  }

  return (
    <Modal titulo={`Relatório de ${relatorio.mesPorExtenso}`} aoFechar={aoFechar} largo>
      <div className="rel__numeros"><Olho className="olho--canto" />
        <div className="rel__num"><span>Recebido</span><strong>{dinheiro(relatorio.receitaCentavos)}</strong></div>
        <div className="rel__num"><span>Pagamentos</span><strong>{relatorio.pagamentos}</strong></div>
        <div className="rel__num"><span>Ticket médio</span><strong>{dinheiro(relatorio.ticketMedioCentavos)}</strong></div>
      </div>
      {variacao && <p className={`rel__variacao t-${variacao.tom}`}>{variacao.texto}</p>}

      <h4 className="rel__titulo">Últimos 6 meses</h4>
      <BarrasVerticais
        dados={relatorio.serie.map((s) => ({
          rotulo: mesCurto(s.mes, s.mes.endsWith('-01')),
          valor: s.totalCentavos,
          detalhe: `${s.pagamentos} ${s.pagamentos === 1 ? 'pagamento' : 'pagamentos'}`,
          destaque: s.mes === relatorio.mes,
        }))}
        formatar={dinheiro}
      />

      {relatorio.formas.length > 0 && (
        <>
          <h4 className="rel__titulo">Como o dinheiro entrou</h4>
          <BarrasHorizontais
            dados={relatorio.formas.map((f) => ({
              rotulo: ROTULO_FORMA[f.forma] ?? f.forma,
              valor: f.totalCentavos,
              detalhe: `${f.quantidade} ${f.quantidade === 1 ? 'pagamento' : 'pagamentos'}`,
            }))}
            formatar={dinheiro}
          />
        </>
      )}

      <h4 className="rel__titulo">Mensagem pronta</h4>
      <pre className="rel__texto">{relatorio.texto}</pre>
      <div className="rel__acoes">
        <a className="btn btn-primary" href={linkGrupoWhatsapp(relatorio.texto)} target="_blank" rel="noopener noreferrer">
          Mandar no WhatsApp
        </a>
        <button type="button" className="btn btn-secondary" onClick={copiar}>
          {copiado ? 'Copiado' : 'Copiar texto'}
        </button>
      </div>
      <p className="form-nota">
        O WhatsApp abre com o relatório escrito e você escolhe para quem mandar. Nada sai daqui sozinho.
      </p>
    </Modal>
  );
}
