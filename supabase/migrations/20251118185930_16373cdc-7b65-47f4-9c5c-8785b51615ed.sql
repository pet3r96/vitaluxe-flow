-- Enable realtime for critical tables that frontend subscribes to
ALTER PUBLICATION supabase_realtime ADD TABLE practice_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE patient_follow_ups;
ALTER PUBLICATION supabase_realtime ADD TABLE patient_medical_vault;
ALTER PUBLICATION supabase_realtime ADD TABLE patient_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE provider_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE patient_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE pharmacies;
ALTER PUBLICATION supabase_realtime ADD TABLE pending_reps;
ALTER PUBLICATION supabase_realtime ADD TABLE cart;