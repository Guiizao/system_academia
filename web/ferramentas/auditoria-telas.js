// Auditoria de telas (uso do Claude/Codex, nunca entra no build: nada importa este arquivo).
// Com `npm run dev` no ar e logado, no console ou no javascript_tool do navegador:
//   await import('/ferramentas/auditoria-telas.js?v=' + Date.now()); await window.__auditar()
// Devolve 'ok' ou os achados por tela (estouro, texto cortado, sobreposicao, desalinhado).
// Rode nos 6 tamanhos do padrao-frontend e no celular deitado (844x390).
// Varredura visual: roda dentro da pagina, em cada tela do menu.
window.__auditar = async function () {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const W = innerWidth, movel = W < 768;
  const nome = (el) => (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase())
    + ' "' + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26) + '"';
  const visivel = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0; };
  const checar = () => {
    // com o painel escondido as animacoes nao andam: termina as de entrada antes de medir
    for (const a of document.getAnimations()) { try { if (a.effect?.getTiming().iterations !== Infinity) a.finish(); } catch {} }
    const achados = new Set();
    if (document.documentElement.scrollWidth > W + 1) achados.add('ESTOURO horizontal: ' + document.documentElement.scrollWidth + 'px');
    // 1. caixa encostada na borda da tela (so no celular/tablet, onde nao ha lateral)
    if (movel) for (const el of document.querySelectorAll('.card, .bloco, .painel, .busca, .tabela, .chips > :first-child, .vazio, .aviso-linha, .pix-caixa, .historico')) {
      if (!visivel(el) || el.closest('.modal-caixa, .bottomnav, .topbar')) continue;
      const r = el.getBoundingClientRect();
      const primeiroChip = el.parentElement?.classList.contains('chips');
      if (r.left < 6 || (!primeiroChip && W - r.right < 6)) achados.add('GRUDADA na borda: ' + nome(el) + ` (${Math.round(r.left)} | ${Math.round(W - r.right)})`);
    }
    // 2. filho passando para fora da propria caixa
    for (const box of document.querySelectorAll('.card, .bloco, .painel, .produto, .tabela__linha, .modal-caixa')) {
      if (!visivel(box)) continue;
      const rb = box.getBoundingClientRect();
      for (const f of box.querySelectorAll('button, strong, span, small, img, input, select, .badge')) {
        if (!visivel(f)) continue;
        const rf = f.getBoundingClientRect();
        if (rf.right > rb.right + 1.5 || rf.left < rb.left - 1.5) { achados.add('VAZA da caixa: ' + nome(f) + ' em ' + nome(box)); break; }
      }
    }
    // 3. botao com texto quebrado em duas linhas: conta as linhas REAIS do texto
    for (const bt of document.querySelectorAll('.btn, .chip, .sidebar__item, .badge, [role=tab]')) {
      if (!visivel(bt)) continue;
      const tops = [];
      const it = document.createTreeWalker(bt, NodeFilter.SHOW_TEXT);
      for (let n = it.nextNode(); n; n = it.nextNode()) {
        if (!n.textContent.trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) if (q.width > 1) tops.push(q.top);
      }
      tops.sort((a, b) => a - b);
      if (tops.filter((v, i) => i === 0 || v - tops[i - 1] > 6).length >= 2) achados.add('QUEBRA em 2 linhas: ' + nome(bt));
    }
    // 3b. texto encostado na borda da caixa que o contem (o defeito das cobrancas)
    for (const box of document.querySelectorAll('.card, .bloco, .painel, .previa, .historico, .modal-caixa, .produto')) {
      if (!visivel(box)) continue;
      const cs = getComputedStyle(box);
      if (cs.borderLeftWidth === '0px' && cs.backgroundColor === 'rgba(0, 0, 0, 0)') continue;
      const rb = box.getBoundingClientRect();
      const it = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
      for (let n = it.nextNode(); n; n = it.nextNode()) {
        const el = n.parentElement;
        if (!n.textContent.trim() || !el || !visivel(el) || el.closest('button, .badge, .chip, svg')) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        const q = rg.getBoundingClientRect();
        if (q.width < 2 || q.bottom < rb.top || q.top > rb.bottom) continue;
        if (q.left - rb.left < 6 || rb.right - q.right < 6) { achados.add('COLADO na borda: "' + n.textContent.trim().slice(0, 24) + '" em ' + nome(box)); break; }
      }
    }
    // 4. texto cortado sem reticencias (overflow escondido)
    for (const el of document.querySelectorAll('strong, .tabela__forte, h1, h2, h3, .produto__nome, label')) {
      if (!visivel(el)) continue;
      const s = getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth + 2 && s.overflow !== 'visible' && s.textOverflow !== 'ellipsis') achados.add('CORTADO: ' + nome(el));
    }
    // 5. cartoes irmaos sobrepostos
    const grupos = new Map();
    for (const c of document.querySelectorAll('.card, .bloco, .painel')) { if (!visivel(c)) continue; const p = c.parentElement; if (!grupos.has(p)) grupos.set(p, []); grupos.get(p).push(c); }
    for (const lista of grupos.values()) for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i].getBoundingClientRect(), z = lista[j].getBoundingClientRect();
      const sx = Math.min(a.right, z.right) - Math.max(a.left, z.left), sy = Math.min(a.bottom, z.bottom) - Math.max(a.top, z.top);
      if (sx > 2 && sy > 2) achados.add('SOBREPOSTOS: ' + nome(lista[i]) + ' x ' + nome(lista[j]));
    }
    // 6. o olho em cima de numero ou nome (o defeito das fotos da academia)
    for (const o of document.querySelectorAll('.olho')) {
      if (!visivel(o)) continue;
      const ro = o.getBoundingClientRect();
      const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = it.nextNode(); n; n = it.nextNode()) {
        const el = n.parentElement;
        if (!n.textContent.trim() || !el || o.contains(el) || !visivel(el)) continue;
        // texto de outra camada (atras da janela aberta) nao conta
        if (el.closest('.modal-caixa') !== o.closest('.modal-caixa')) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) {
          // texto escondido pela rolagem de uma lista tambem nao
          let escondido = false;
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            const sa = getComputedStyle(a);
            if (sa.overflowX === 'visible' && sa.overflowY === 'visible') continue;
            const ra = a.getBoundingClientRect(), cy = (q.top + q.bottom) / 2, cx = (q.left + q.right) / 2;
            if (cy < ra.top || cy > ra.bottom || cx < ra.left || cx > ra.right) { escondido = true; break; }
          }
          if (escondido) continue;
          const sx = Math.min(q.right, ro.right) - Math.max(q.left, ro.left), sy = Math.min(q.bottom, ro.bottom) - Math.max(q.top, ro.top);
          if (sx > 1 && sy > 1) { achados.add('OLHO por cima: "' + n.textContent.trim().slice(0, 24) + '"'); break; }
        }
      }
    }
    // 7. titulo da tela e primeiro bloco na mesma coluna (Produtos e Agenda
    //    tinham o titulo 18px para dentro dos cartoes)
    const tit = document.querySelector('.conteudo > .container > .sec-head:first-child h2');
    if (tit && visivel(tit)) {
      const tl = tit.getBoundingClientRect().left;
      const blocos = [...document.querySelectorAll('.conteudo > .container .card, .conteudo > .container .secao, .fin__cartoes, .pg-tabela, .loja__num, .aula, .ficha-previa, .ia-linha, .pix-nota, .resumo, .atalho, .plano')]
        .filter((b) => visivel(b) && !b.closest('.modal-caixa'));
      if (blocos.length) {
        const menor = Math.min(...blocos.map((b) => b.getBoundingClientRect().left));
        if (Math.abs(menor - tl) > 1.5) achados.add(`DESALINHADO: titulo em ${Math.round(tl)}px, blocos em ${Math.round(menor)}px`);
      }
    }
    // 8. icone espremido por texto longo ao lado (a faixa de divida da 0.1.17 virava um pontinho)
    for (const svg of document.querySelectorAll('svg[width]')) {
      const w = svg.getBoundingClientRect().width;
      if (visivel(svg.parentElement) && w > 0 && w < Number(svg.getAttribute('width')) * 0.8) achados.add(`ICONE ESPREMIDO: ${nome(svg.parentElement)} (${Math.round(w)}px)`);
    }
    return achados.size ? [...achados].slice(0, 12) : 'ok';
  };
  const telas = ['Início', 'Alunos', 'Treinos', 'Agenda', 'Financeiro', 'Produtos', 'Configurações'];
  const saida = {};
  for (const t of telas) {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t || x.title === t);
    if (!b) { saida[t] = 'sem botao'; continue; }
    b.click(); await espera(1300);
    // abre as listas que comecam fechadas: o defeito pode estar dentro delas
    for (const x of document.querySelectorAll('[aria-expanded="false"]')) x.click();
    await espera(700);
    saida[t] = checar();
  }
  // a ficha do aluno e a janela de editar pagamento nao estao no menu
  const clicar = (sel, txt) => { const el = [...document.querySelectorAll(sel)].find((x) => !txt || x.textContent.includes(txt)); el?.click(); return !!el; };
  [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Alunos' || x.title === 'Alunos')?.click(); await espera(1200);
  // o selo Vencido abre a confirmacao de inativo
  if (clicar('.badge--acao')) { await espera(900); saida['Confirmar inativo'] = checar(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await espera(700); }
  else saida['Confirmar inativo'] = 'sem vencido';
  if (clicar('.aluno-item__abrir', 'José')) {
    await espera(900); clicar('[role=tab]', 'Pagamentos'); await espera(900);
    saida['Ficha: Pagamentos'] = checar();
    if (clicar('button[aria-label^="Editar pagamento"]')) { await espera(900); saida['Editar pagamento'] = checar(); }
    for (let i = 0; i < 2; i++) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await espera(500); }
  } else saida['Ficha: Pagamentos'] = 'sem aluno José';
  // os paineis completos abertos pelas previas (Financeiro e Treinos)
  const irPara = async (t) => { [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t || x.title === t)?.click(); await espera(1300); };
  const esc = async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await espera(700); };
  for (const [rotulo, nome] of [['Ver pagamentos', 'Fin: Pagamentos'], ['Ver todas', 'Fin: Cobranças'], ['Gerenciar planos', 'Fin: Planos']]) {
    await irPara('Financeiro');
    const b = [...document.querySelectorAll('.secao__ver')].find((x) => x.textContent.includes(rotulo));
    if (!b) { saida[nome] = 'sem botao'; continue; }
    b.click(); await espera(1300);
    saida[nome] = checar();
    if (nome === 'Fin: Pagamentos') {
      [...document.querySelectorAll('.segmento button')].find((x) => x.textContent.trim() === 'Todos')?.click(); await espera(1200);
      saida['Fin: Pagamentos (todos)'] = checar();
      [...document.querySelectorAll('.segmento button')].find((x) => x.textContent.trim() === 'Alterações')?.click(); await espera(1000);
      saida['Fin: Alterações'] = checar();
    }
    await esc();
  }
  await irPara('Treinos');
  const ficha = document.querySelector('.ficha-previa');
  if (ficha) { ficha.click(); await espera(1200); saida['Treinos: ficha'] = checar(); await esc(); }
  return { tamanho: W + 'x' + innerHeight, ...saida };
};
'auditoria carregada';
