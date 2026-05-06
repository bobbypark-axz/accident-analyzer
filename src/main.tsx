import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppShell from './AppShell';
import { AdminPage } from './pages-features/admin/AdminPage';
import './index.css';

const isAdminRoute =
  window.location.pathname === '/admin' ||
  window.location.pathname.startsWith('/admin/') ||
  new URLSearchParams(window.location.search).get('admin') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? <AdminPage /> : <AppShell />}
  </StrictMode>
);
