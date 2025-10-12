import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeErrorHandlers } from "./lib/errorLogger";

// Initialize global error handlers
initializeErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);
