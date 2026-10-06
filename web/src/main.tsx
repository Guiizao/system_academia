import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './estilos/global.css';
import { aplicarTema, acompanharSistema } from './tema';
import { aplicarEfeitos } from './efeitos';

aplicarTema();
acompanharSistema();
aplicarEfeitos();

// dentro do app de PC a janela nao tem moldura: a pagina desenha a barra de titulo
if (window.dfJanela) document.documentElement.classList.add('com-barra-janela');

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);

// PWA: so em producao (em dev o SW atrapalharia o recarregamento do Vite)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
