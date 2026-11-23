import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'katex/dist/katex.min.css'; // bundled locally by Vite (offline-safe, replaces the jsDelivr CDN link)
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
