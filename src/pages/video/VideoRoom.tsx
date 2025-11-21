import { Navigate } from "react-router-dom";

/**
 * VideoRoom - DEPRECATED
 * 
 * This route has been removed from the application.
 * All video sessions must use session-based URLs:
 * - /practice/video/:sessionId for providers
 * - /patient/video/:sessionId for patients
 * 
 * These routes ensure proper token generation and channel resolution.
 */
export default function VideoRoom() {
  return <Navigate to="/dashboard" replace />;
}
