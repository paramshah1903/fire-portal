import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Catches any uncaught render error in the
 * child tree and shows a friendly recovery screen instead of leaving
 * the whole SPA as a blank white page.
 *
 * A component-tree crash in a corner of the app (e.g. a third-party
 * library that mishandles the DOM) shouldn't take the whole app down.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Best-effort logging to the console with the React component stack.
    console.error('[error-boundary] uncaught error', error, info.componentStack);
  }

  handleReload = () => {
    // Full reload — the safest way back to a working state after an
    // unexpected crash.
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-red-700">
              Something went wrong
            </p>
            <h1 className="mt-1 text-lg font-semibold text-slate-900">
              This page hit an unexpected error
            </h1>
            <p className="mt-2 text-sm text-slate-700">
              Your session is still active. Try reloading the page — if the
              problem repeats, please report it with the message below.
            </p>
            <pre className="mt-3 max-h-40 overflow-auto rounded bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100">
              {this.state.error.message}
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
              >
                Reload page
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
