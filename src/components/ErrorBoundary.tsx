import React, { Component, ErrorInfo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Detect dynamic import failures (chunk loading errors)
    const msg = (error as any)?.message || '';
    const name = (error as any)?.name || '';
    
    // Detect AuthContext errors (React Error #185)
    const isAuthContextError = 
      msg.includes('useAuth must be used within an AuthProvider') ||
      msg.includes('AuthContext');

    if (isAuthContextError) {
      console.warn('[ErrorBoundary] AuthContext timing error detected - attempting auto-recovery');
      
      // Auto-retry once by refreshing
      const hasRetried = sessionStorage.getItem('auth-error-retry');
      if (!hasRetried) {
        sessionStorage.setItem('auth-error-retry', 'true');
        setTimeout(() => {
          window.location.reload();
        }, 500);
        return;
      }
      sessionStorage.removeItem('auth-error-retry');
    }
    
    const isChunkLoadError =
      name === 'ChunkLoadError' ||
      name === 'SyntaxError' ||
      /Unexpected token/.test(msg) ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes("'text/html' is not a valid JavaScript MIME type") ||
      msg.includes('Failed to fetch') ||
      msg.includes('Loading chunk');
    
    import('@/lib/logger').then(({ logger }) => {
      if (isChunkLoadError) {
        logger.warn('Chunk loading failed - likely stale cache after deployment', error);
      }
      logger.error('ErrorBoundary caught an error', error, logger.sanitize({
        componentStack: errorInfo.componentStack,
        browser: navigator.userAgent,
        url: window.location.href,
        isChunkLoadError
      }));
    });

    // Auto-reload once for chunk/MIME errors to clear stale cache
    if (isChunkLoadError && !sessionStorage.getItem('chunk_reload_attempted')) {
      sessionStorage.setItem('chunk_reload_attempted', 'true');
      console.log('[ErrorBoundary] Auto-reloading to clear stale cache...');
      setTimeout(() => {
        window.location.href = window.location.pathname + '?v=' + Date.now();
      }, 1000);
      return;
    }

    // Log error to database via edge function
    supabase.functions
      .invoke('log-error', {
        body: {
          action_type: 'client_error',
          entity_type: 'react_component',
          details: {
            error_message: error.message,
            error_stack: error.stack,
            component_stack: errorInfo.componentStack,
            browser: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((logError) => {
        import('@/lib/logger').then(({ logger }) => {
          logger.error('Failed to log error to backend', logError);
        });
      });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      const isChunkError = 
        this.state.error?.message?.includes('Failed to fetch') ||
        this.state.error?.message?.includes('Loading chunk') ||
        this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('Importing a module script failed') ||
        this.state.error?.name === 'ChunkLoadError';

      const isCacheIssue = isChunkError;

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <CardTitle>
                  {isCacheIssue ? "App Update Detected" : "Something went wrong"}
                </CardTitle>
              </div>
              <CardDescription>
                {isCacheIssue 
                  ? "We've recently upgraded VitaLuxe with new features and improvements. Please refresh your browser to get the latest version."
                  : "An unexpected error occurred. Our team has been notified and will investigate."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isCacheIssue && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p className="text-sm font-medium">Quick Refresh Options:</p>
                  <ul className="text-sm space-y-1 ml-4 list-disc text-muted-foreground">
                    <li><strong>Windows:</strong> Press <kbd className="px-1.5 py-0.5 bg-muted/50 rounded">Ctrl+Shift+R</kbd></li>
                    <li><strong>Mac:</strong> Press <kbd className="px-1.5 py-0.5 bg-muted/50 rounded">Cmd+Shift+R</kbd></li>
                    <li><strong>Or:</strong> Click the button below</li>
                  </ul>
                </div>
              )}

              {!isCacheIssue && this.state.error && (
                <div className="p-3 rounded-md bg-muted text-sm font-mono overflow-auto max-h-40">
                  {this.state.error.message}
                </div>
              )}
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    sessionStorage.clear();
                    window.location.reload();
                  }} 
                  className="flex-1"
                  variant={isCacheIssue ? "default" : "outline"}
                >
                  {isCacheIssue ? "Refresh Now" : "Reload Page"}
                </Button>
                {!isCacheIssue && (
                  <Button onClick={this.handleReset} className="flex-1">
                    Return to Dashboard
                  </Button>
                )}
              </div>

              {!isCacheIssue && this.state.error && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Technical Details
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                    {this.state.error.message}
                    {this.state.error.stack && '\n\n' + this.state.error.stack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
