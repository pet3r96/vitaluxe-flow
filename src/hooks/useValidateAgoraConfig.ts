import { useCallback } from 'react';

export const useValidateAgoraConfig = () => {
  const validateConfig = useCallback(async (appId: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/verify-agora-config?appId=${appId}`
      );
      
      if (!res.ok) {
        throw new Error(`Validation request failed: ${res.status}`);
      }

      const data = await res.json();

      if (!data.match) {
        console.error("❌ Agora App ID mismatch!", data);
        console.error(`   Frontend: ${data.frontendAppId}`);
        console.error(`   Backend: ${data.backendAppId}`);
        throw new Error("App ID mismatch between frontend and backend");
      }

      console.log("✅ Agora App ID verified:", data.backendAppId);
      return data;
    } catch (error) {
      console.error("❌ Failed to validate Agora config:", error);
      throw error;
    }
  }, []);

  return { validateConfig };
};
