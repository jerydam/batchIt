import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Web3Provider } from './context/Web3Context';
import { ToastProvider } from './context/ToastContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Web3Provider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </Web3Provider>
  </StrictMode>
);
