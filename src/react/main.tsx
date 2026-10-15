import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.css';
import { App } from './App.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('React root element is missing.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
