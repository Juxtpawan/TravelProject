import { createRoot } from 'react-dom/client';
import App from './app/app.jsx';
import './index.css';
import { StrictMode } from 'react';
import { AppProviders } from './app/providers.jsx';

createRoot(document.getElementById('root')).render(
  <AppProviders>
    <StrictMode><App /></StrictMode>
  </AppProviders>
);
