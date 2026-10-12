import { useMemo, useState } from 'react';
import { api } from '../dados/api';
import { useDados } from '../dados/useDados';
import { useSessao } from '../sessao';
import { formatarData } from '../dominio';
import { Modal } from '../componentes/Modal';
import { ConfirmarSenha } from '../componentes/ConfirmarSenha';
import { Olho, useValores } from '../componentes/Valores';
import type { FormaPagamento, Produto, SituacaoVenda, Venda } from '../tipos';
import './Produtos.css';

/**
 * A lojinha da academia: o que tem na prateleira, quanto custa, quanto sobrou
 * e quem levou. Venda fiada fica em aberto até alguém clicar em Receber.
 *
 * Cadastro e edição de produto são do dono; vender e receber, de quem cuida
 * do caixa (dono e recepção) -- a mesma regra do Financeiro.
 */

const MAX_FOTOS = 3;
const LADO_DA_FOTO = 640;           // px do lado maior depois de reduzir
const ESTOQUE_BAIXO = 3;
const FORMAS: Array<[FormaPagamento, string]> = [['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['debito', 'Débito'], ['credito', 'Crédito']];
const ROTULO_FORMA = Object.fromEntries(FORMAS) as Record<string, string>;

/**
 * Reduz a foto no próprio navegador antes de mandar: foto de celular tem
 * 4 MB, e o servidor guarda no banco. Em 640px ela fica com ~60 KB e continua
 * nítida no tamanho em que aparece na tela.
 */
function reduzirFoto(arquivo: File): Promise<string> {
  return new Promise((pronto, falhou) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, LADO_DA_FOTO / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      pronto(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => falhou(new Error('Não consegui abrir essa imagem.'));
    img.src = URL.createObjectURL(arquivo);
  });
}

export function Produtos() {
  const { usuario, avisar } = useSessao();
  const dono = usuario.papel === 'dono';
  const { formatar: dinheiro } = useValores();
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState<SituacaoVenda>('fiado');
  const [editando, setEditando] = useState<Produto | 'novo' | null>(null);
  const [vendendo, setVendendo] = useState<Produto | null>(null);
  const [cancelando, setCancelando] = useState<Venda | null>(null);

  const { dados: produtos, recarregar: recProdutos, carregando } = useDados(() => api.produtos(), []);
  const { dados: vendas, recarregar: recVendas } = useDados(() => api.vendas(aba), [aba]);
  const { dados: fiados } = useDados(() => api.vendas('fiado'), [vendas]);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (produtos ?? []).filter((p) => !t || `${p.nome} ${p.categoria ?? ''}`.toLowerCase().includes(t));
  }, [produtos, busca]);

  const emFalta = (produtos ?? []).filter((p) => p.estoque <= ESTOQUE_BAIXO).length;
  const fiadoAberto = (fiados ?? []).reduce((s, v) => s + v.totalCentavos, 0);
  const atualizar = () => { recProdutos(); recVendas(); };

  async function receber(v: Venda, forma: FormaPagamento) {
    try {
      await api.receberVenda(v.id, forma);
      avisar(`${dinheiro(v.totalCentavos)} recebido de ${v.alunoNome ?? v.clienteNome}`, 'ok');
      recVendas();
    } catch (e: any) { avisar(e.message, 'erro'); }
  }

  return (
    <div className="container entrar">
      <div className="sec-head">
        <h2>Produtos<Olho /></h2>
        {dono && <button className="btn btn-primary btn-sm" onClick={() => setEditando('novo')}>Novo produto</button>}
      </div>

      <div className="loja__numeros">
        <div className="card loja__num"><span>Produtos</span><strong>{produtos?.length ?? 0}</strong></div>
        <div className="card loja__num"><span>Com estoque baixo</span>
          <strong className={emFalta ? 't-warn' : ''}>{emFalta}</strong></div>
        <div className="card loja__num"><span>Fiado em aberto</span>
          <strong className={fiadoAberto ? 't-danger' : ''}>{dinheiro(fiadoAberto)}</strong></div>
      </div>

      <div className="busca loja__busca">
        <input placeholder="Buscar produto ou categoria" value={busca} onChange={(e) => setBusca(e.target.value)}
               aria-label="Buscar produto" />
      </div>

      {carregando && !produtos ? <div className="carregando">Carregando…</div>
        : !visiveis.length ? (
          <div className="vazio">
            {produtos?.length ? 'Nenhum produto com esse nome.' : dono
              ? 'Nenhum produto ainda. Comece por "Novo produto": whey, creatina, garrafa, camiseta…'
              : 'Nenhum produto cadastrado. Peça ao dono para cadastrar.'}
          </div>
        ) : (
          <div className="loja__grade escalonar">
            {visiveis.map((p) => (
              <article key={p.id} className="card produto">
                <div className="produto__foto">
                  {p.fotos[0] ? <img src={p.fotos[0]} alt={p.nome} loading="lazy" /> : <span aria-hidden="true">{p.nome[0]}</span>}
                  {p.fotos.length > 1 && <small className="produto__mais">+{p.fotos.length - 1}</small>}
                </div>
                <div className="produto__corpo">
                  <strong className="produto__nome">{p.nome}</strong>
                  {p.categoria && <small className="produto__cat">{p.categoria}</small>}
                  <div className="produto__linha">
                    <span className="produto__preco num">{dinheiro(p.precoCentavos)}</span>
                    <span className={`badge ${p.estoque === 0 ? 'b-danger' : p.estoque <= ESTOQUE_BAIXO ? 'b-warn' : 'b-ok'}`}>
                      {p.estoque === 0 ? 'Esgotado' : `${p.estoque} em estoque`}
                    </span>
                  </div>
                  <div className="produto__acoes">
                    <button className="btn btn-primary btn-sm" disabled={p.estoque === 0} onClick={() => setVendendo(p)}>Vender</button>
                    {dono && <button className="btn btn-secondary btn-sm" onClick={() => setEditando(p)}>Editar</button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

      <section className="loja__vendas">
        <div className="sec-head">
          <h3>Vendas</h3>
          <div className="chips" role="tablist">
            {(['fiado', 'paga'] as const).map((s) => (
              <button key={s} role="tab" aria-selected={aba === s} className={`chip ${aba === s ? 'on' : ''}`} onClick={() => setAba(s)}>
                {s === 'fiado' ? 'Fiado (a receber)' : 'Pagas'}
              </button>
            ))}
          </div>
        </div>
        {!vendas?.length ? (
          <div className="vazio">{aba === 'fiado' ? 'Ninguém devendo nada.' : 'Nenhuma venda paga ainda.'}</div>
        ) : (
          <div className="tabela">
            {vendas.map((v) => (
              <div key={v.id} className="tabela__linha">
                <div>
                  <div className="tabela__forte">{v.quantidade}× {v.produtoNome}</div>
                  <div className="tabela__fraco">
                    {v.alunoNome ?? v.clienteNome ?? 'Venda no balcão'}, {formatarData(v.dataVenda)}
                    {v.situacao === 'paga' && v.forma ? `, ${ROTULO_FORMA[v.forma] ?? v.forma}` : ''}
                    {v.pagaEm && v.pagaEm !== v.dataVenda ? `, recebido em ${formatarData(v.pagaEm)}` : ''}
                  </div>
                </div>
                <div className="pag__lado">
                  <strong className={v.situacao === 'fiado' ? 'valor-danger' : 'valor-ok'}>{dinheiro(v.totalCentavos)}</strong>
                  {v.situacao === 'fiado' && (
                    <select className="loja__receber" aria-label={`Receber de ${v.alunoNome ?? v.clienteNome}`} value=""
                            onChange={(e) => e.target.value && receber(v, e.target.value as FormaPagamento)}>
                      <option value="">Receber…</option>
                      {FORMAS.map(([f, r]) => <option key={f} value={f}>em {r}</option>)}
                    </select>
                  )}
                  {dono && <button className="btn btn-danger btn-sm" onClick={() => setCancelando(v)}>Cancelar</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editando && (
        <FormProduto produto={editando === 'novo' ? null : editando} aoFechar={() => setEditando(null)}
                     aoSalvar={(msg) => { setEditando(null); avisar(msg, 'ok'); atualizar(); }} />
      )}
      {vendendo && (
        <FormVenda produto={vendendo} aoFechar={() => setVendendo(null)}
                   aoVender={(msg) => { setVendendo(null); avisar(msg, 'ok'); atualizar(); }} />
      )}
      {cancelando && (
        <ConfirmarSenha
          titulo="Cancelar venda"
          rotuloBotao={`Cancelar ${cancelando.quantidade}× ${cancelando.produtoNome}`}
          explicacao={<>A venda some e <b>{cancelando.quantidade}</b> {cancelando.quantidade === 1 ? 'unidade volta' : 'unidades voltam'} para o estoque.</>}
          aoFechar={() => setCancelando(null)}
          aoConfirmar={async (senha) => {
            await api.cancelarVenda(cancelando.id, senha);
            setCancelando(null);
            avisar('Venda cancelada e estoque devolvido.', 'ok');
            atualizar();
          }}
        />
      )}
    </div>
  );
}

/* ─── cadastro e edição ─────────────────────────────────── */

function FormProduto({ produto, aoFechar, aoSalvar }: {
  produto: Produto | null; aoFechar: () => void; aoSalvar: (msg: string) => void;
}) {
  const [nome, setNome] = useState(produto?.nome ?? '');
  const [categoria, setCategoria] = useState(produto?.categoria ?? '');
  const [descricao, setDescricao] = useState(produto?.descricao ?? '');
  const [preco, setPreco] = useState(produto ? (produto.precoCentavos / 100).toFixed(2).replace('.', ',') : '');
  const [estoque, setEstoque] = useState(String(produto?.estoque ?? 0));
  const [fotos, setFotos] = useState<string[]>(produto?.fotos ?? []);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function adicionarFotos(lista: FileList | null) {
    if (!lista) return;
    try {
      const novas = await Promise.all([...lista].slice(0, MAX_FOTOS - fotos.length).map(reduzirFoto));
      setFotos((f) => [...f, ...novas].slice(0, MAX_FOTOS));
    } catch (e: any) { setErro(e.message); }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const centavos = Math.round(Number(preco.replace(/\./g, '').replace(',', '.')) * 100);
    if (!Number.isFinite(centavos) || centavos <= 0) { setErro('Preço inválido. Exemplo: 129,90'); return; }
    setErro(null); setEnviando(true);
    try {
      await api.salvarProduto({
        id: produto?.id, nome: nome.trim(), categoria: categoria.trim() || null, descricao: descricao.trim() || null,
        precoCentavos: centavos, estoque: Math.max(0, Math.trunc(Number(estoque) || 0)), fotos,
      });
      aoSalvar(produto ? 'Produto atualizado' : 'Produto cadastrado');
    } catch (err: any) { setErro(err.message); }
    finally { setEnviando(false); }
  }

  async function excluir() {
    if (!produto || !confirm(`Tirar "${produto.nome}" da loja?`)) return;
    try { await api.excluirProduto(produto.id); aoSalvar('Produto removido da loja'); }
    catch (err: any) { setErro(err.message); }
  }

  return (
    <Modal titulo={produto ? 'Editar produto' : 'Novo produto'} aoFechar={aoFechar}>
      <form onSubmit={salvar}>
        <div className="campo"><label htmlFor="pr-nome">Nome</label>
          <input id="pr-nome" required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Whey 900 g, chocolate" /></div>
        <div className="linha3">
          <div className="campo"><label htmlFor="pr-preco">Preço (R$)</label>
            <input id="pr-preco" required inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="129,90" /></div>
          <div className="campo"><label htmlFor="pr-estoque">Estoque</label>
            <input id="pr-estoque" type="number" min={0} step={1} value={estoque} onChange={(e) => setEstoque(e.target.value)} /></div>
          <div className="campo"><label htmlFor="pr-cat">Categoria</label>
            <input id="pr-cat" maxLength={40} value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Suplemento" /></div>
        </div>
        <div className="campo"><label htmlFor="pr-desc">Descrição</label>
          <textarea id="pr-desc" rows={2} maxLength={300} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>

        <div className="campo">
          <label>Fotos (até {MAX_FOTOS})</label>
          <div className="fotos">
            {fotos.map((f, i) => (
              <div key={i} className="fotos__item">
                <img src={f} alt={`Foto ${i + 1}`} />
                <button type="button" className="fotos__tirar" aria-label={`Tirar foto ${i + 1}`}
                        onClick={() => setFotos((l) => l.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            {fotos.length < MAX_FOTOS && (
              <label className="fotos__add">
                <input type="file" accept="image/*" multiple hidden onChange={(e) => { adicionarFotos(e.target.files); e.target.value = ''; }} />
                + Foto
              </label>
            )}
          </div>
          <p className="form-nota">A primeira foto é a que aparece na vitrine.</p>
        </div>

        {erro && <div className="form-erro" role="alert">{erro}</div>}
        <button className="btn btn-primary btn-bloco" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar produto'}</button>
        {produto && <button type="button" className="btn btn-perigo-fraco btn-bloco" onClick={excluir}>Tirar da loja</button>}
      </form>
    </Modal>
  );
}

/* ─── vender ────────────────────────────────────────────── */

function FormVenda({ produto, aoFechar, aoVender }: {
  produto: Produto; aoFechar: () => void; aoVender: (msg: string) => void;
}) {
  const { dados: alunos } = useDados(() => api.alunos(), []);
  const [quantidade, setQuantidade] = useState(1);
  const [para, setPara] = useState('');            // nome digitado: aluno da lista ou cliente avulso
  const [situacao, setSituacao] = useState<SituacaoVenda>('paga');
  const [forma, setForma] = useState<FormaPagamento>('pix');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { formatar: dinheiro } = useValores();

  // o nome digitado bate com um aluno? Então a venda fica no nome dele
  const aluno = alunos?.find((a) => a.nome.toLowerCase() === para.trim().toLowerCase());
  const total = produto.precoCentavos * quantidade;

  async function vender(e: React.FormEvent) {
    e.preventDefault();
    if (situacao === 'fiado' && !para.trim()) { setErro('Fiado precisa do nome de quem levou.'); return; }
    setErro(null); setEnviando(true);
    try {
      await api.vender({
        produtoId: produto.id, quantidade, situacao,
        ...(aluno ? { alunoId: aluno.id } : para.trim() ? { clienteNome: para.trim() } : {}),
        ...(situacao === 'paga' ? { forma } : {}),
      });
      aoVender(situacao === 'fiado'
        ? `${dinheiro(total)} anotado no fiado de ${aluno?.nome ?? para.trim()}`
        : `Venda de ${dinheiro(total)} registrada`);
    } catch (err: any) { setErro(err.message); }
    finally { setEnviando(false); }
  }

  return (
    <Modal titulo={`Vender ${produto.nome}`} aoFechar={aoFechar}>
      <form onSubmit={vender}>
        <div className="linha2">
          <div className="campo"><label htmlFor="vd-qtd">Quantidade</label>
            <input id="vd-qtd" type="number" min={1} max={produto.estoque} required value={quantidade}
                   onChange={(e) => setQuantidade(Math.max(1, Math.trunc(Number(e.target.value) || 1)))} />
            <small className="form-nota">{produto.estoque} em estoque</small></div>
          <div className="campo"><label htmlFor="vd-para">Para quem</label>
            <input id="vd-para" list="vd-alunos" value={para} onChange={(e) => setPara(e.target.value)}
                   placeholder="Aluno ou cliente (opcional se pago)" autoComplete="off" />
            <datalist id="vd-alunos">{alunos?.map((a) => <option key={a.id} value={a.nome} />)}</datalist>
            <small className="form-nota">{aluno ? 'Aluno cadastrado' : para.trim() ? 'Cliente avulso' : 'Venda no balcão'}</small></div>
        </div>

        <div className="campo"><span className="campo__rot">Pagamento</span>
          <div className="chips">
            <button type="button" className={`chip ${situacao === 'paga' ? 'on' : ''}`} onClick={() => setSituacao('paga')}>Pago agora</button>
            <button type="button" className={`chip ${situacao === 'fiado' ? 'on' : ''}`} onClick={() => setSituacao('fiado')}>Fiado (paga depois)</button>
          </div>
        </div>
        {situacao === 'paga' && (
          <div className="campo"><label htmlFor="vd-forma">Forma</label>
            <select id="vd-forma" value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
              {FORMAS.map(([f, r]) => <option key={f} value={f}>{r}</option>)}
            </select></div>
        )}

        <div className="pagamento-total"><span>Total</span><strong>{dinheiro(total)}</strong></div>
        {erro && <div className="form-erro" role="alert">{erro}</div>}
        <button className="btn btn-primary btn-bloco" disabled={enviando}>
          {enviando ? 'Registrando…' : situacao === 'fiado' ? `Anotar no fiado` : `Confirmar venda de ${dinheiro(total)}`}
        </button>
      </form>
    </Modal>
  );
}
