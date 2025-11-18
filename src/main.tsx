import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeErrorHandlers } from "./lib/errorLogger";
import './lib/performanceReporter';

// Initialize global error handlers
initializeErrorHandlers();

// Log build identifier for deployment verification
import { logger } from "./lib/logger";
const buildId = import.meta.env.VITE_BUILD_ID || "dev";
logger.info(`Vitaluxe Build: ${buildId.substring(0, 7)}`);

createRoot(document.getElementById("root")!).render(<App />);
