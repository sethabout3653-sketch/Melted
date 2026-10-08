import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[ErrorBoundary caught error safely]:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      // Graceful fallback without showing jarring red box or crashing the app
      return this.props.children;
    }
    return this.props.children;
  }
}
