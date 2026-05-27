import { createRoot } from 'react-dom/client'
import App from './app/App'
import { EditorSettingsProvider } from './app/context/EditorSettingsContext'
import { SchematicSettingsProvider } from './app/context/SchematicSettingsContext'
import { ThemeProvider } from './app/context/ThemeContext'
import { UserProvider } from './app/context/UserContext'
import { installGeneratedFonts } from './styles/generatedFonts'
import './styles/index.css'

installGeneratedFonts()

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <EditorSettingsProvider>
      <SchematicSettingsProvider>
        <UserProvider>
          <App />
        </UserProvider>
      </SchematicSettingsProvider>
    </EditorSettingsProvider>
  </ThemeProvider>,
)
