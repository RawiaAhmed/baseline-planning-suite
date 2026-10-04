import type { ShellContext } from '@baseline/contracts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

/** Standalone mode: no shell around us, so supply the context the shell would push in. */
const standaloneContext: ShellContext = {
  currency: { code: 'EUR', perEuro: 1 },
  activeUser: { id: 'standalone', name: 'Standalone user' },
};

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App {...standaloneContext} />
  </StrictMode>,
);
