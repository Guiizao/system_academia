// Painel do servidor. So conversa com o processo principal via window.df
// (preload): nao tem acesso ao Node nem ao disco.
const $ = (id) => document.getElementById(id);
let ultimoEstado = null;

// barra de titulo: minimizar, tela cheia (alterna) e fechar (vai para a bandeja)
const janela = window.df.janela;
$('j-min').onclick = () => janela.minimizar();
$('j-max').onclick = () => janela.maximizar();
$('j-fechar').onclick = () => janela.fechar();
function marcarMaximizada(sim) {
  document.body.classList.toggle('maximizada', sim);
  const rotulo = sim ? 'Restaurar' : 'Tela cheia';
  $('j-max').title = rotulo; $('j-max').setAttribute('aria-label', rotulo);
}
janela.maximizada().then(marcarMaximizada);
janela.aoMudar(marcarMaximizada);

function avisar(msg, erro = false) {
  const a = $('aviso');
  a.textContent = msg; a.className = 'aviso' + (erro ? ' erro-aviso' : ''); a.hidden = false;
  clearTimeout(avisar.t); avisar.t = setTimeout(() => { a.hidden = true; }, 3200);
}

async function executar(botao, fn, msgOk) {
  botao.disabled = true;
  try { await fn(); if (msgOk) avisar(msgOk); }
  catch (e) { avisar(String(e.message).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), true); }
  finally { botao.disabled = false; }
}

async function desenhar(s) {
  ultimoEstado = s;
  $('versao').textContent = s.versao;
  $('ponto').className = 'ponto ' + (s.rodando ? 'on' : 'off');
  $('cartao-status').className = 'cartao cartao-status ' + (s.rodando ? 'no-ar' : 'parado');
  $('status-titulo').textContent = s.rodando ? 'Sistema no ar' : 'Sistema parado';
  const temRede = s.urls.some((u) => !u.includes('localhost'));
  $('status-sub').textContent = !s.rodando
    ? 'Ninguém consegue acessar até você iniciar.'
    : temRede
      ? 'Recepção, celulares e outros PCs da rede já podem acessar.'
      : 'Funcionando só neste computador: o notebook está sem rede.';
  $('btn-abrir').disabled = !s.rodando;
  $('btn-alternar').textContent = s.rodando ? 'Parar servidor' : 'Iniciar servidor';
  $('btn-alternar').className = 'btn ' + (s.rodando ? 'btn-perigo' : 'btn-primario');
  $('btn-backup').disabled = !s.rodando;
  $('chk-windows').checked = s.iniciarComWindows;
  $('cartao-config').hidden = !s.precisaConfigurar;

  // o endereco da rede local e o que o celular usa. Sem rede: so este PC.
  const rede = s.urls.find((u) => !u.includes('localhost'));
  $('com-rede').hidden = s.rodando && !rede;
  $('sem-rede').hidden = !(s.rodando && !rede);
  $('urls').innerHTML = '';
  for (const u of s.urls) {
    const li = document.createElement('li');
    li.textContent = u;
    const dica = document.createElement('small');
    dica.textContent = u.includes('localhost') ? 'só neste PC' : 'celular e outros PCs';
    li.appendChild(dica);
    $('urls').appendChild(li);
  }
  if (!s.rodando) $('urls').innerHTML = '<li style="color:var(--muted)">Servidor parado</li>';
  $('qr').src = rede ? await window.df.qr(rede) : '';
  $('qr').style.visibility = rede ? 'visible' : 'hidden';

  $('backups').innerHTML = '';
  if (!s.backups.length) $('backups').innerHTML = '<li>Nenhum backup ainda</li>';
  for (const b of s.backups) {
    const li = document.createElement('li');
    const m = b.nome.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})/);
    li.innerHTML = `<span></span><span></span>`;
    const quando = m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : b.nome;
    li.children[0].textContent = b.nome.startsWith('antes-do-reset') ? `${quando}, antes de começar do zero` : quando;
    li.children[1].textContent = `${(b.bytes / 1024).toFixed(0)} KB`;
    $('backups').appendChild(li);
  }
}

$('btn-abrir').onclick = () => window.df.abrirSistema();
$('btn-alternar').onclick = (e) => executar(e.target, () => (ultimoEstado?.rodando ? window.df.parar() : window.df.iniciar()));
$('btn-backup').onclick = (e) => executar(e.target, () => window.df.backup(), 'Backup concluído');
$('btn-pasta-backup').onclick = () => window.df.abrirPasta('backups');
$('btn-pasta-dados').onclick = () => window.df.abrirPasta('dados');
$('chk-windows').onchange = (e) => window.df.iniciarComWindows(e.target.checked);
$('btn-demo').onclick = (e) => executar(e.target, () => window.df.dadosDemo(), 'Demonstração carregada. Entre com joao@darkfisic.com e a senha darkfisic123');
$('form-config').onsubmit = async (ev) => {
  ev.preventDefault();
  const dados = Object.fromEntries(new FormData(ev.target));
  $('erro-config').hidden = true;
  try {
    await window.df.primeiroAcesso(dados);
    ev.target.senha.value = '';   // senha nao fica parada no formulario
    avisar('Conta criada. Entre no sistema com seu e-mail.');
  }
  catch (e) {
    $('erro-config').textContent = String(e.message).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    $('erro-config').hidden = false;
  }
};

// Comecar do zero: dois passos e a frase digitada
$('btn-reset').onclick = () => { $('reset-passo1').hidden = true; $('reset-passo2').hidden = false; $('txt-reset').value = ''; $('txt-reset').focus(); };
$('btn-reset-cancela').onclick = () => { $('reset-passo2').hidden = true; $('reset-passo1').hidden = false; };
$('txt-reset').oninput = (e) => { $('btn-reset-ok').disabled = e.target.value !== 'APAGAR TUDO'; };
$('btn-reset-ok').onclick = (e) => executar(e.target, async () => {
  await window.df.resetarDados($('txt-reset').value);
  $('reset-passo2').hidden = true; $('reset-passo1').hidden = false;
}, 'Dados apagados. Uma cópia ficou na pasta de backups.');

window.df.aoMudarEstado(desenhar);
window.df.aoLog((linha) => { const l = $('logs'); l.textContent += linha + '\n'; l.scrollTop = l.scrollHeight; });
window.df.logs().then((ls) => { $('logs').textContent = ls.join('\n') + (ls.length ? '\n' : ''); });
window.df.estado().then(desenhar);
