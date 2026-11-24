import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="p-8 text-slate-100">FinTech Banker English Studio</div>
  </StrictMode>
);
