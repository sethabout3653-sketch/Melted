import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error('[Melted ErrorBoundary] Caught error:', error, errorInfo);
  }

  public handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#08080a] text-zinc-100 flex items-center justify-center p-6 select-none">
          <div className="max-w-md w-full bg-[#121216] border border-white/10 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-600/15 border border-red-500/30 text-red-400 flex items-center justify-center text-2xl font-bold">
              !
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-extrabold text-white">Something went wrong</h1>
              <p className="text-xs text-zinc-400 leading-relaxed">
                An unexpected error occurred while running the app. You can try refreshing the page.
              </p>
            </div>

            <button
              onClick={this.handleReload}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
            >
              Refresh Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
