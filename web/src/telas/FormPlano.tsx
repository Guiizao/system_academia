import { useState } from 'react';
import { api } from '../dados/api';
import { useSessao } from '../sessao';
import { Modal } from '../componentes/Modal';
import type { Plano } from '../tipos';

/** Preco novo vale para as proximas matriculas. Quem ja pagou mantem o valor contratado. */
export function FormPlano({ plano, aoFechar, aoSalvar }: {
  /** null = criar um plano novo */
  plano: Plano | null; aoFechar: () => void; aoSalvar: () => void;
}) {
  const { avisar } = useSessao();
  const novo = plano === null;
  const [nome, setNome] = useState(plano?.nome ?? '');
  const [preco, setPreco] = useState(plano ? (plano.precoCentavos / 100).toFixed(2).replace('.', ',') : '');
  // diária é outro tipo de produto, não "um plano de 0 mês": o formulário separa
  const [tipo, setTipo] = useState<'mes' | 'dia'>(plano?.duracaoDias ? 'dia' : 'mes');
  const [duracao, setDuracao] = useState(String(plano?.duracaoMeses || 1));
  const [dias, setDias] = useState(String(plano?.duracaoDias ?? 1));
  const [beneficios, setBeneficios] = useState(plano?.beneficios.join('\n') ?? '');
  const [destaque, setDestaque] = useState(plano?.destaque ?? false);
  const [confirmando, setConfirmando] = useState<'desativar' | 'excluir' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const trocouDeTipo = !novo && (plano!.duracaoDias != null) !== (tipo === 'dia');

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(null);
    const reais = Number(preco.replace(/\./g, '').replace(',', '.'));
    if (!nome.trim()) { setErro('Dê um nome ao plano'); return; }
    if (!(reais > 0)) { setErro('Preço inválido'); return; }
    const lista = beneficios.split('\n').map((b) => b.trim()).filter(Boolean);
    const campos = {
      nome: nome.trim(),
      precoCentavos: Math.round(reais * 100),
      duracaoMeses: tipo === 'dia' ? 0 : Number(duracao),
      duracaoDias: tipo === 'dia' ? Number(dias) : null,
      beneficios: lista,
    };

    setEnviando(true);
    try {
      if (novo) {
        await api.criarPlano(campos);
        avisar(`Plano ${campos.nome} criado`, 'ok');
      } else {
        await api.atualizarPlano(plano.id, { ...campos, destaque });
        avisar(`Plano ${campos.nome} atualizado`, 'ok');
      }
      aoSalvar();
    } catch (err: any) { setErro(err.message); }
    finally { setEnviando(false); }
  }

  /** desativar, reativar e excluir: todas passam pelo mesmo tratamento de erro */
  async function acao(fn: () => Promise<unknown>, recado: string) {
    setErro(null); setEnviando(true);
    try {
      await fn();
      avisar(recado, 'ok');
      aoSalvar();
    } catch (err: any) { setErro(err.message); setConfirmando(null); }
    finally { setEnviando(false); }
  }

  return (
    <Modal titulo={novo ? 'Novo plano' : `Editar ${plano.nome}`} aoFechar={aoFechar}>
      <form onSubmit={salvar}>
        <div className="campo"><label htmlFor="pl-nome">Nome do plano</label>
          <input id="pl-nome" required autoFocus maxLength={60} value={nome}
                 placeholder="Mensal, Trimestral, Mensal com personal…"
                 onChange={(e) => setNome(e.target.value)} /></div>

        <div className="campo">
          <label>Tipo</label>
          <div className="opcoes-linha" role="radiogroup" aria-label="Tipo de plano">
            <button type="button" role="radio" aria-checked={tipo === 'mes'}
                    className={`chip ${tipo === 'mes' ? 'on' : ''}`} onClick={() => setTipo('mes')}>
              Mensalidade
            </button>
            <button type="button" role="radio" aria-checked={tipo === 'dia'}
                    className={`chip ${tipo === 'dia' ? 'on' : ''}`} onClick={() => setTipo('dia')}>
              Diária
            </button>
          </div>
        </div>

        <div className="linha2">
          <div className="campo"><label htmlFor="pl-preco">Preço (R$)</label>
            <input id="pl-preco" inputMode="decimal" required value={preco} placeholder="90,00"
                   onChange={(e) => setPreco(e.target.value)} /></div>
          <div className="campo">
            <label htmlFor="pl-dur">{tipo === 'dia' ? 'Vale quantos dias' : 'Vale quantos meses'}</label>
            {/* número livre: 2 meses, 4 meses, 15 dias -- o que a academia vender */}
            {tipo === 'dia' ? (
              <input id="pl-dur" type="number" min={1} max={60} required value={dias}
                     onChange={(e) => setDias(e.target.value)} />
            ) : (
              <input id="pl-dur" type="number" min={1} max={24} required value={duracao}
                     onChange={(e) => setDuracao(e.target.value)} />
            )}
          </div>
        </div>

        <div className="campo"><label htmlFor="pl-ben">Benefícios (um por linha)</label>
          <textarea id="pl-ben" rows={4} value={beneficios} onChange={(e) => setBeneficios(e.target.value)} /></div>

        {!novo && (
          <label className="checkbox-linha">
            <input type="checkbox" checked={destaque} onChange={(e) => setDestaque(e.target.checked)} />
            Mostrar como mais popular
          </label>
        )}

        <p className="form-nota">
          {tipo === 'dia'
            ? 'Diária vale os dias escolhidos e acaba: não gera cobrança no mês seguinte. Na hora de receber, dá para marcar o dia em que o aluno vem.'
            : 'O preço e a duração novos valem para as próximas matrículas e renovações. Quem já pagou mantém o que foi contratado.'}
        </p>
        {trocouDeTipo && (
          <p className="form-nota form-nota--atencao">
            Trocar entre mensalidade e diária só é aceito se nenhum aluno estiver com
            matrícula em curso nesse plano. Se tiver, o sistema avisa e nada é alterado.
          </p>
        )}
        {erro && <div className="form-erro" role="alert">{erro}</div>}
        <button className="btn btn-primary btn-bloco" disabled={enviando}>
          {enviando ? 'Salvando…' : novo ? 'Criar plano' : 'Salvar plano'}
        </button>
      </form>

      {!novo && (
        <div className="zona-perigo">
          {plano.ativo ? (
            confirmando !== 'desativar' ? (
              <button className="btn btn-secondary btn-bloco" disabled={enviando}
                      onClick={() => { setErro(null); setConfirmando('desativar'); }}>
                Desativar plano
              </button>
            ) : (
              <>
                <p className="form-nota">
                  O plano some da lista de venda. Quem já está matriculado nele continua
                  normalmente, e o histórico de pagamentos não muda. Dá para reativar depois.
                </p>
                <div className="linha2">
                  <button className="btn btn-secondary" onClick={() => setConfirmando(null)}>Cancelar</button>
                  <button className="btn btn-danger" disabled={enviando}
                          onClick={() => acao(() => api.atualizarPlano(plano.id, { ativo: false }),
                                              `${plano.nome} saiu da lista de venda`)}>
                    Confirmar
                  </button>
                </div>
              </>
            )
          ) : (
            <>
              <p className="form-nota">Este plano está desativado: não aparece na lista de venda.</p>
              <button className="btn btn-primary btn-bloco" disabled={enviando}
                      onClick={() => acao(() => api.atualizarPlano(plano.id, { ativo: true }),
                                          `${plano.nome} voltou para a lista de venda`)}>
                Reativar plano
              </button>
            </>
          )}

          {confirmando !== 'excluir' ? (
            <button className="btn btn-perigo-fraco btn-bloco" disabled={enviando}
                    onClick={() => { setErro(null); setConfirmando('excluir'); }}>
              Excluir de vez
            </button>
          ) : (
            <>
              <p className="form-nota">
                Apaga o plano da lista para sempre. Só funciona se ele nunca foi vendido —
                se já tem matrícula, o sistema recusa e manda desativar, para não furar o histórico.
              </p>
              <div className="linha2">
                <button className="btn btn-secondary" onClick={() => setConfirmando(null)}>Cancelar</button>
                <button className="btn btn-danger" disabled={enviando}
                        onClick={() => acao(() => api.excluirPlano(plano.id), `${plano.nome} foi excluído`)}>
                  Excluir
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
