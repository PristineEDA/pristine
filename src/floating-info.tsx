import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './app/context/ThemeContext';
import { FloatingInfoWindow } from './floating-info/FloatingInfoWindow';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <FloatingInfoWindow />
  </ThemeProvider>,
);
