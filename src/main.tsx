import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeErrorHandlers } from "./lib/errorLogger";

// Initialize global error handlers
initializeErrorHandlers();

// Log build identifier for deployment verification
const buildId = import.meta.env.VITE_BUILD_ID || 'dev';
console.log(`🚀 Vitaluxe Build: ${buildId.substring(0, 7)}`);

createRoot(document.getElementById("root")!).render(<App />);
