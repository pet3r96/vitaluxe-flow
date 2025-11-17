import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export const useValidateAgoraConfig = () => {
  const validateConfig = useCallback(async (appId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-agora-config', {
        body: { appId }
      });

      if (error) {
        throw new Error(`Validation request failed: ${error.message}`);
      }

      if (!data.match) {
        logger.error("Agora App ID mismatch", null, {
          frontendAppId: data.frontendAppId,
          backendAppId: data.backendAppId
        });
        throw new Error("App ID mismatch between frontend and backend");
      }

      logger.info("Agora App ID verified", { backendAppId: data.backendAppId });
      return data;
    } catch (error) {
      logger.error("Failed to validate Agora config", error);
      throw error;
    }
  }, []);

  return { validateConfig };
};
