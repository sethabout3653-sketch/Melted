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
    console.error('[FrostHub render error]', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <main role="alert" className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <section className="max-w-lg w-full rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl">
            <h1 className="text-xl font-bold">FrostHub couldn’t start</h1>
            <p className="mt-2 text-sm text-slate-300">
              The app hit a startup error. Reload the preview; if it persists, check the browser console for details.
            </p>
            {this.state.error?.message && (
              <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-red-200 whitespace-pre-wrap">
                {this.state.error.message}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500"
            >
              Reload app
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
