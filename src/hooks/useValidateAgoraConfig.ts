// 🧹 TODO AGORA REFACTOR
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useValidateAgoraConfig = () => {
  const validateConfig = useCallback(async (appId: string) => {
    // try {
    //   const { data, error } = await supabase.functions.invoke('verify-agora-config', {
    //     body: { appId }
    //   });
    return Promise.resolve({ match: true, backendAppId: appId }); // Stub for now
    /* Original code commented out:
    try {
      const { data, error } = await supabase.functions.invoke('verify-agora-config', {
        body: { appId }
      });

      if (error) {
        throw new Error(`Validation request failed: ${error.message}`);
      }

      if (!data.match) {
        console.error("❌ Agora App ID mismatch!", data);
        console.error(`   Frontend: ${data.frontendAppId}`);
        console.error(`   Backend: ${data.backendAppId}`);
        throw new Error("App ID mismatch between frontend and backend");
      }

      // console.log("✅ Agora App ID verified:", data.backendAppId);
      // return data;
    // } catch (error) {
    //   console.error("❌ Failed to validate Agora config:", error);
    //   throw error;
    // }
    */
  }, []);

  return { validateConfig };
};
