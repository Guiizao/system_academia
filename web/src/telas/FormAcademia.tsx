import { useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao } from '../sessao';
import { Modal } from '../componentes/Modal';

const CAMPOS: Array<[string, string, string?]> = [
  ['nome', 'Nome da academia'], ['cnpj', 'CNPJ'], ['telefone', 'Telefone'], ['whatsapp', 'WhatsApp da academia'],
  ['instagram', 'Instagram', '@academia'], ['endereco', 'Endereço'],
];

export function FormAcademia({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: () => void }) {
  const { avisar } = useSessao();
  const { dados } = useDados(() => api.academia(), []);
  const [v, setV] = useState<Record<string, any> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const val = v ?? dados;
  if (!val) return <Modal titulo="Dados da academia" aoFechar={aoFechar}><div className="carregando">Carregando…</div></Modal>;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...val, [k]: e.target.value });

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(null);
    const corpo: Record<string, unknown> = {};
    for (const [k] of CAMPOS) corpo[k] = val![k] ?? '';
    for (const k of ['pixChave', 'pixTipo', 'pixNomeRecebedor', 'pixCidade']) if (val![k]) corpo[k] = val![k];
    corpo.diasAvisoVencimento = Number(val!.diasAvisoVencimento);
    corpo.diasAlunoSumido = Number(val!.diasAlunoSumido);
    try { await api.atualizarAcademia(corpo); avisar('Dados da academia salvos', 'ok'); aoSalvar(); }
    catch (err: any) { setErro(err.message); }
  }

  return (
    <Modal titulo="Dados da academia" aoFechar={aoFechar} largo>
      <form onSubmit={salvar}>
        <div className="linha2">
          {CAMPOS.map(([k, rot, ph]) => (
            <div className="campo" key={k}><label htmlFor={`ac-${k}`}>{rot}</label>
              <input id={`ac-${k}`} placeholder={ph} value={val[k] ?? ''} onChange={set(k)} required={k === 'nome'} /></div>
          ))}
        </div>
        <h4 className="form-secao">Pix para receber as mensalidades</h4>
        <div className="linha2">
          <div className="campo"><label htmlFor="ac-pixtipo">Tipo de chave</label>
            <select id="ac-pixtipo" value={val.pixTipo ?? 'cnpj'} onChange={set('pixTipo')}>
              <option value="cnpj">CNPJ</option><option value="cpf">CPF</option><option value="email">E-mail</option>
              <option value="telefone">Telefone</option><option value="aleatoria">Chave aleatória</option>
            </select></div>
          <div className="campo"><label htmlFor="ac-pix">Chave Pix</label>
            <input id="ac-pix" value={val.pixChave ?? ''} onChange={set('pixChave')} /></div>
          <div className="campo"><label htmlFor="ac-rec">Nome do recebedor (como aparece no banco)</label>
            <input id="ac-rec" value={val.pixNomeRecebedor ?? ''} onChange={set('pixNomeRecebedor')} /></div>
          <div className="campo"><label htmlFor="ac-cid">Cidade</label>
            <input id="ac-cid" value={val.pixCidade ?? ''} onChange={set('pixCidade')} /></div>
        </div>
        <p className="form-nota">Depois de salvar, gere um Pix de R$ 0,01 para você mesmo e confira no app do banco se o nome do recebedor está certo.</p>
        <h4 className="form-secao">Prazos</h4>
        <div className="linha2">
          <div className="campo"><label htmlFor="ac-aviso">Avisar vencimento com quantos dias</label>
            <input id="ac-aviso" type="number" min={1} max={60} value={val.diasAvisoVencimento} onChange={set('diasAvisoVencimento')} /></div>
          <div className="campo"><label htmlFor="ac-sumido">Aluno sumido depois de quantos dias sem vir</label>
            <input id="ac-sumido" type="number" min={1} max={60} value={val.diasAlunoSumido} onChange={set('diasAlunoSumido')} /></div>
        </div>
        {erro && <div className="form-erro" role="alert">{erro}</div>}
        <button className="btn btn-primary btn-bloco">Salvar dados</button>
      </form>
    </Modal>
  );
}
