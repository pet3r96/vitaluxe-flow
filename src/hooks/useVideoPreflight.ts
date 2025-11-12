import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DiagnosticResult {
  name: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  timestamp: string;
  details?: any;
}

export const useVideoPreflight = () => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);

  const addDiagnostic = (result: Omit<DiagnosticResult, 'timestamp'>) => {
    setDiagnostics(prev => [...prev, {
      ...result,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const runPingTest = async (): Promise<boolean> => {
    addDiagnostic({
      name: 'Backend Ping',
      status: 'pending',
      message: 'Testing backend connectivity...'
    });

    try {
      console.log('🔍 [Preflight] Starting edge-ping test...');
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const { data, error } = await supabase.functions.invoke('edge-ping', {
        signal: controller.signal
      });

      clearTimeout(timeout);

      console.log('📥 [Preflight] edge-ping response:', { data, error });

      if (error) {
        console.error('❌ [Preflight] edge-ping error:', {
          message: error.message,
          name: error.name,
          context: error.context,
          status: error.status,
          fullError: error
        });
        throw error;
      }

      if (data?.ok) {
        console.log('✅ [Preflight] edge-ping success:', data);
        addDiagnostic({
          name: 'Backend Ping',
          status: 'success',
          message: `Backend reachable (${data.region || 'unknown region'})`,
          details: data
        });
        return true;
      }

      throw new Error('Ping returned invalid response');
    } catch (err: any) {
      console.error('❌ [Preflight] edge-ping catch block:', err);
      
      addDiagnostic({
        name: 'Backend Ping',
        status: 'error',
        message: err.name === 'AbortError' 
          ? 'Backend timeout (>10s)' 
          : `Backend unreachable: ${err.message}`,
        details: { 
          error: err.message, 
          name: err.name,
          status: err.status,
          context: err.context,
          fullError: JSON.stringify(err, null, 2)
        }
      });
      return false;
    }
  };

  const runHealthCheck = async (): Promise<{ success: boolean; data?: any }> => {
    addDiagnostic({
      name: 'Agora Health Check',
      status: 'pending',
      message: 'Validating Agora credentials...'
    });

    try {
      const { data, error } = await supabase.functions.invoke('agora-healthcheck');

      if (error || !data?.healthy) {
        const errorMsg = data?.error || error?.message || 'Invalid credentials';
        addDiagnostic({
          name: 'Agora Health Check',
          status: 'error',
          message: `Configuration error: ${errorMsg}`,
          details: data || error
        });
        return { success: false };
      }

      addDiagnostic({
        name: 'Agora Health Check',
        status: 'success',
        message: 'Agora credentials valid',
        details: data
      });
      return { success: true, data };
    } catch (err: any) {
      addDiagnostic({
        name: 'Agora Health Check',
        status: 'error',
        message: `Health check failed: ${err.message}`,
        details: err
      });
      return { success: false };
    }
  };

  const runJoinAttempt = async (
    functionName: string,
    body: any
  ): Promise<{ success: boolean; data?: any; error?: any }> => {
    const startTime = Date.now();
    
    addDiagnostic({
      name: 'Join Session',
      status: 'pending',
      message: `Calling ${functionName}...`
    });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
        signal: controller.signal
      });

      clearTimeout(timeout);
      const elapsed = Date.now() - startTime;

      if (error) {
        const isAuthError = error.message?.includes('401') || error.message?.includes('Unauthorized');
        
        addDiagnostic({
          name: 'Join Session',
          status: 'error',
          message: isAuthError 
            ? 'Authentication required - please log in again'
            : `Failed: ${error.message} (${elapsed}ms)`,
          details: { error, elapsed }
        });

        return { success: false, error };
      }

      addDiagnostic({
        name: 'Join Session',
        status: 'success',
        message: `Session joined successfully (${elapsed}ms)`,
        details: { data, elapsed }
      });

      return { success: true, data };
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError';

      addDiagnostic({
        name: 'Join Session',
        status: 'error',
        message: isTimeout
          ? `Timeout after ${elapsed}ms - backend may be overloaded`
          : `Network error: ${err.message}`,
        details: { error: err.message, elapsed }
      });

      return { success: false, error: err };
    }
  };

  const clearDiagnostics = () => {
    setDiagnostics([]);
  };

  return {
    diagnostics,
    runPingTest,
    runHealthCheck,
    runJoinAttempt,
    addDiagnostic,
    clearDiagnostics
  };
};
