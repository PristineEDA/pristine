import { createRoot } from 'react-dom/client'
import App from './app/App'
import { EditorSettingsProvider } from './app/context/EditorSettingsContext'
import { ThemeProvider } from './app/context/ThemeContext'
import { UserProvider } from './app/context/UserContext'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <EditorSettingsProvider>
      <UserProvider>
        <App />
      </UserProvider>
    </EditorSettingsProvider>
  </ThemeProvider>,
)
