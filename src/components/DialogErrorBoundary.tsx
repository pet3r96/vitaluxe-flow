import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from './ui/button';
import { DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

interface Props {
  children: ReactNode;
  onClose?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class DialogErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dialog Error:', error, errorInfo);
  }

  private handleClose = () => {
    this.setState({ hasError: false, error: null });
    this.props.onClose?.();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Dialog Error
            </DialogTitle>
            <DialogDescription>
              Something went wrong while loading this dialog
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-destructive/10 p-4 border border-destructive/20">
            <p className="text-sm text-destructive font-mono">
              {this.state.error?.message || 'Unknown error'}
            </p>
          </div>
          <Button onClick={this.handleClose} variant="outline" className="gap-2">
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
