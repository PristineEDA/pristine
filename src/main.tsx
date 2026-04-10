
  import { createRoot } from "react-dom/client";
  import { EditorSettingsProvider } from "./app/context/EditorSettingsContext";
  import { ThemeProvider } from "./app/context/ThemeContext";
  import App from "./app/App";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(
    <ThemeProvider>
      <EditorSettingsProvider>
        <App />
      </EditorSettingsProvider>
    </ThemeProvider>
  );
  