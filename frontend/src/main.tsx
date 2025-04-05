// Importar os polyfills e interceptores de erros primeiro
import './react-early-intercept.js';
import './fix-layout-effect.js';

// Importações regulares do React
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Renderizar o aplicativo
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
