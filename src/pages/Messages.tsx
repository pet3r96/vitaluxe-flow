import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePagePerformance } from "@/hooks/usePagePerformance";

const Messages = () => {
  usePagePerformance('Messages');
  const { effectiveRole } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect to appropriate page based on role
    if (effectiveRole === 'topline' || effectiveRole === 'downline') {
      navigate('/support-tickets', { replace: true });
    } else if (effectiveRole === 'patient') {
      navigate('/patient-messages', { replace: true });
    } else {
      // For doctors, staff, providers - redirect to support tickets
      navigate('/support-tickets', { replace: true });
    }
  }, [effectiveRole, navigate]);
  
  return null;
};

export default Messages;
