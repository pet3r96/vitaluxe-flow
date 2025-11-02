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
    const isChunkLoadError = error.message?.includes('Failed to fetch dynamically imported module') ||
                            error.message?.includes('error loading dynamically imported module') ||
                            error.message?.includes('Importing a module script failed') ||
                            error.message?.includes("'text/html' is not a valid JavaScript MIME type");
    
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
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
              <CardDescription>
                {this.state.error?.message?.includes('dynamically imported module') || 
                 this.state.error?.message?.includes('Importing a module script failed') ? (
                  <>
                    Failed to load application module. This usually happens after an update.
                    <br />
                    <strong>Please clear your browser cache and reload the page.</strong>
                  </>
                ) : (
                  'An unexpected error occurred. Our team has been notified.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="p-3 rounded-md bg-muted text-sm font-mono overflow-auto max-h-40">
                  {this.state.error.message}
                </div>
              )}
              
              {(this.state.error?.message?.includes('dynamically imported module') || 
                this.state.error?.message?.includes('Failed to fetch') ||
                this.state.error?.message?.includes("'text/html' is not a valid JavaScript MIME type")) && (
                <div className="mt-4 p-4 bg-muted/30 border border-border rounded-lg">
                  <p className="text-sm font-semibold mb-2">
                    🔄 Cache Issue Detected - Auto-reloading...
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    The app has been updated and will reload automatically. If the issue persists:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                    <li><strong>Hard Refresh:</strong> Press <kbd className="px-1.5 py-0.5 bg-muted/50 rounded">Ctrl+Shift+R</kbd> (Windows) or <kbd className="px-1.5 py-0.5 bg-muted/50 rounded">Cmd+Shift+R</kbd> (Mac)</li>
                    <li><strong>Clear Cache:</strong> Browser Settings → Privacy → Clear Browsing Data</li>
                    <li><strong>Incognito Mode:</strong> Try opening in a private/incognito window</li>
                  </ul>
                  <button
                    onClick={() => {
                      sessionStorage.clear();
                      window.location.href = window.location.pathname + '?v=' + Date.now();
                    }}
                    className="mt-3 px-3 py-1.5 text-sm bg-gold1 hover:bg-gold1/90 text-white rounded"
                  >
                    Clear Storage & Reload Now
                  </button>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button onClick={this.handleReset} className="flex-1">
                  Return to Dashboard
                </Button>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
