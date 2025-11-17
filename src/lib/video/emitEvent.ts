import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export async function emitEvent(sessionId: string, eventType: string, userUid: string) {
  const { error } = await supabase.from("video_session_events").insert({
    session_id: sessionId,
    event_type: eventType,
    user_uid: userUid,
  });

  if (error) {
    logger.error("Failed to emit video session event", error, { sessionId, eventType });
  }
}
