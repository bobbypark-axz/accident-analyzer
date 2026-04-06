import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// TDS는 토스 미니앱 환경에서 자동으로 로드되므로 별도 임포트 불필요
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
