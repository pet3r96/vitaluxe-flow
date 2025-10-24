-- Create function to sync practice address to all linked providers
CREATE OR REPLACE FUNCTION public.sync_practice_address_to_providers(p_practice_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update all providers linked to this practice
  UPDATE profiles
  SET 
    shipping_address_street = (SELECT address_street FROM profiles WHERE id = p_practice_id),
    shipping_address_city = (SELECT address_city FROM profiles WHERE id = p_practice_id),
    shipping_address_state = (SELECT address_state FROM profiles WHERE id = p_practice_id),
    shipping_address_zip = (SELECT address_zip FROM profiles WHERE id = p_practice_id),
    shipping_address_formatted = (
      SELECT CONCAT_WS(', ', 
        address_street,
        address_city,
        CONCAT(address_state, ' ', address_zip)
      )
      FROM profiles 
      WHERE id = p_practice_id
    ),
    updated_at = now()
  WHERE id IN (
    SELECT user_id FROM providers WHERE practice_id = p_practice_id
  )
  AND id != p_practice_id; -- Don't update the practice itself
END;
$function$;

-- Create trigger function to sync when practice address changes
CREATE OR REPLACE FUNCTION public.trigger_sync_practice_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only sync if address fields changed
  IF (NEW.address_street IS DISTINCT FROM OLD.address_street) OR
     (NEW.address_city IS DISTINCT FROM OLD.address_city) OR
     (NEW.address_state IS DISTINCT FROM OLD.address_state) OR
     (NEW.address_zip IS DISTINCT FROM OLD.address_zip) THEN
    
    -- Check if this profile is a practice (has role = 'doctor')
    IF EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = NEW.id AND role = 'doctor'::app_role
    ) THEN
      PERFORM sync_practice_address_to_providers(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS on_practice_address_update ON profiles;
CREATE TRIGGER on_practice_address_update
AFTER UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION trigger_sync_practice_address();

-- IMMEDIATE BACKFILL: Update all existing providers with their practice addresses
UPDATE profiles
SET 
  shipping_address_street = practice.address_street,
  shipping_address_city = practice.address_city,
  shipping_address_state = practice.address_state,
  shipping_address_zip = practice.address_zip,
  shipping_address_formatted = CONCAT_WS(', ', 
    practice.address_street,
    practice.address_city,
    CONCAT(practice.address_state, ' ', practice.address_zip)
  ),
  updated_at = now()
FROM providers prov
JOIN profiles practice ON prov.practice_id = practice.id
WHERE profiles.id = prov.user_id
  AND practice.address_street IS NOT NULL
  AND profiles.shipping_address_street IS NULL;