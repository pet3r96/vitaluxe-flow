import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useWelcomeTour() {
  const { effectiveRole, effectiveUserId, mustChangePassword, termsAccepted } = useAuth();
  const [showTour, setShowTour] = useState(false);
  const [loading, setLoading] = useState(true);

  const isEligibleRole = effectiveRole === "doctor" || effectiveRole === "staff";

  useEffect(() => {
    if (!effectiveUserId || !isEligibleRole || mustChangePassword || !termsAccepted) {
      setLoading(false);
      return;
    }

    const checkTourStatus = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("has_seen_welcome_tour")
        .eq("id", effectiveUserId)
        .maybeSingle();

      if (data && !data.has_seen_welcome_tour) {
        setShowTour(true);
      }
      setLoading(false);
    };

    checkTourStatus();
  }, [effectiveUserId, isEligibleRole, mustChangePassword, termsAccepted]);

  const dismissTour = useCallback(async () => {
    setShowTour(false);
    if (effectiveUserId) {
      await supabase
        .from("profiles")
        .update({ has_seen_welcome_tour: true })
        .eq("id", effectiveUserId);
    }
  }, [effectiveUserId]);

  const replayTour = useCallback(() => {
    setShowTour(true);
  }, []);

  return { showTour, loading, dismissTour, replayTour, isEligibleRole };
}
