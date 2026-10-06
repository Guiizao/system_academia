// Roteiro das capturas usadas nos PDFs de documentacao.
import { writeFileSync } from 'node:fs';

const H = `window.__c=(t)=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(t));if(!b)throw new Error('botao: '+t);b.click();};
window.__nav=(t)=>{const b=[...document.querySelectorAll('.sidebar__item,.bottomnav__item')].find(b=>b.textContent.includes(t));if(!b)throw new Error('nav: '+t);b.click();};
window.__aluno=(filtro)=>{const b=[...document.querySelectorAll('.aluno-item')].find(filtro);if(!b)throw new Error('aluno nao achado');b.click();};
window.__sel=(sel,i)=>{const s=document.querySelector(sel);Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,s.options[i].value);s.dispatchEvent(new Event('change',{bubbles:true}));};`;
const dono = { email: 'joao@darkfisic.com', senha: 'darkfisic123' };
const prof = { email: 'pedro@darkfisic.com', senha: 'darkfisic123' };
const rec = { email: 'bruna@darkfisic.com', senha: 'darkfisic123' };
const PC = { largura: 1440, altura: 900 };
const CEL = { largura: 390, altura: 844 };
const vencido = "(b)=>b.textContent.includes('Vencido')";

const capturas = [
  { nome: 'pc-login', ...PC, semLogin: true },
  { nome: 'pc-inicio', ...PC, ...dono },
  { nome: 'pc-alunos', ...PC, ...dono, passos: [H, "__nav('Alunos')", `__aluno(${vencido})`] },
  { nome: 'pc-novo-aluno', ...PC, ...rec, passos: [H, "__nav('Alunos')", "__c('Novo aluno')"] },
  { nome: 'pc-pagamento', ...PC, ...rec, passos: [H, "__nav('Alunos')", `__aluno(${vencido})`, "__c('Pagamento')"] },
  { nome: 'pc-avaliacao', ...PC, ...prof, passos: [H, "__nav('Alunos')", "__aluno(()=>true)", "__c('Nova avaliação')"] },
  { nome: 'pc-treinos', ...PC, ...prof, passos: [H, "__nav('Treinos')"] },
  { nome: 'pc-fichas-liberadas', ...PC, ...prof, passos: [H, "__nav('Treinos')", "__c('Liberadas')"] },
  { nome: 'pc-montar-ficha', ...PC, ...prof, passos: [H, "__nav('Treinos')", "__c('Montar ficha')", "__sel('#ff-aluno',3)",
      "__sel('.item-editor__add',2)", "__sel('.item-editor__add',6)", "__sel('.item-editor__add',9)"] },
  { nome: 'pc-agenda', ...PC, ...prof, passos: [H, "__nav('Agenda')"] },
  { nome: 'pc-nova-aula', ...PC, ...prof, passos: [H, "__nav('Agenda')", "__c('Nova aula')"] },
  { nome: 'pc-financeiro', ...PC, ...dono, passos: [H, "__nav('Financeiro')"] },
  { nome: 'pc-financeiro-recepcao', ...PC, ...rec, passos: [H, "__nav('Financeiro')"] },
  { nome: 'pc-avisos', ...PC, ...dono, passos: [H, "__c('Avisos')"] },
  { nome: 'pc-config', ...PC, ...dono, passos: [H, "__nav('Configurações')"] },
  { nome: 'pc-cadastrar-pessoa', ...PC, ...dono, passos: [H, "__nav('Configurações')", "__c('Cadastrar pessoa')",
      "[...document.querySelectorAll('.papel input')][2].click()"] },
  { nome: 'pc-academia-pix', ...PC, ...dono, passos: [H, "__nav('Configurações')", "__c('Editar dados e Pix')"] },
  { nome: 'cel-inicio', ...CEL, ...dono },
  { nome: 'cel-alunos', ...CEL, ...rec, passos: [H, "__nav('Alunos')"] },
  { nome: 'cel-perfil', ...CEL, ...rec, passos: [H, "__nav('Alunos')", `__aluno(${vencido})`] },
  { nome: 'cel-agenda', ...CEL, ...rec, passos: [H, "__nav('Agenda')"] },
];

// 3o argumento opcional: so as capturas com esses nomes (separados por virgula)
const so = process.argv[4]?.split(',');
const escolhidas = so ? capturas.filter((c) => so.includes(c.nome)) : capturas;
writeFileSync(process.argv[2], JSON.stringify({ base: 'http://localhost:3000', pasta: process.argv[3], capturas: escolhidas }));
console.log(escolhidas.length, 'capturas no roteiro');
