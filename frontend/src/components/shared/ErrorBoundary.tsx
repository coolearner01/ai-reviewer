'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors in any child subtree and shows a friendly
 * fallback instead of a blank screen. Wrap each major section of the app
 * so a bug in one card doesn't kill the whole page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div className="rounded-md border border-gh-red/50 bg-gh-red/10 p-5 text-sm text-[#f85149]">
          <p className="font-semibold mb-1">Something went wrong rendering this section.</p>
          <p className="opacity-80">{this.state.error.message}</p>
          <button
            onClick={this.reset}
            className="mt-3 rounded-md border border-gh-red/50 bg-gh-surface px-3 py-1.5 text-xs font-medium text-[#f85149] hover:bg-gh-red/15"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
