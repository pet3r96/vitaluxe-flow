import { supabase } from "@/integrations/supabase/client";

export async function emitEvent(sessionId: string, eventType: string, userUid: string) {
  const { error } = await supabase.from("video_session_events").insert({
    session_id: sessionId,
    event_type: eventType,
    user_uid: userUid,
  });

  if (error) {
    console.error("[emitEvent] Failed to emit event:", error);
  }
}
