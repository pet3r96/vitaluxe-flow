import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeErrorHandlers } from "./lib/errorLogger";

Sentry.init({
  dsn: "https://45aa5fe506c3705d3d829175a4b2cc17@o4510341989597184.ingest.us.sentry.io/4510341991366656",
  sendDefaultPii: true
});

// Initialize global error handlers
initializeErrorHandlers();

// Log build identifier for deployment verification
const buildId = import.meta.env.VITE_BUILD_ID || "dev";
console.log(`🚀 Vitaluxe Build: ${buildId.substring(0, 7)}`);

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container element not found");
}

const root = createRoot(container);
root.render(<App />);
