import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './app/context/ThemeContext';
import { FloatingInfoWindow } from './floating-info/FloatingInfoWindow';
import { installGeneratedFonts } from './styles/generatedFonts';
import './styles/index.css';

installGeneratedFonts();

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <FloatingInfoWindow />
  </ThemeProvider>,
);
