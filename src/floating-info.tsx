import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './app/context/ThemeContext';
import { FloatingInfoWindow } from './floating-info/FloatingInfoWindow';
import { installGeneratedFonts } from './styles/generatedFonts';
import './styles/index.css';

function applyInitialFloatingInfoSurface() {
  const searchParams = new URLSearchParams(window.location.search);
  const backgroundColor = searchParams.get('backgroundColor');
  const themeKind = searchParams.get('themeKind');

  if (themeKind === 'light' || themeKind === 'dark') {
    document.documentElement.style.colorScheme = themeKind;
  }

  if (!backgroundColor) {
    return;
  }

  document.documentElement.style.backgroundColor = backgroundColor;
  document.body.style.backgroundColor = backgroundColor;
}

applyInitialFloatingInfoSurface();

installGeneratedFonts();

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <FloatingInfoWindow />
  </ThemeProvider>,
);
