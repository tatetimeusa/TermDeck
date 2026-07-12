import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initSync } from './sync';
import './styles.css';

// module scope, not an effect — StrictMode double-mounting must not double-init
initSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
