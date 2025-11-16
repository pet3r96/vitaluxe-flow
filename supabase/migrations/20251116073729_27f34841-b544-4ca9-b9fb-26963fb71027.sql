-- Clean up orphaned room_id references before adding FK
UPDATE patient_appointments
SET room_id = NULL
WHERE room_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM practice_rooms WHERE id = patient_appointments.room_id
  );