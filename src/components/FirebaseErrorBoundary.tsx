import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface FirebaseErrorBoundaryProps {
  children: React.ReactNode;
}

interface FirebaseErrorBoundaryState {
  errorMessage: string | null;
}

export class FirebaseErrorBoundary extends React.Component<
  FirebaseErrorBoundaryProps,
  FirebaseErrorBoundaryState
> {
  constructor(props: FirebaseErrorBoundaryProps) {
    super(props);
    this.state = { errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): FirebaseErrorBoundaryState {
    return {
      errorMessage: error.message || 'An unexpected Firebase error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('FirebaseErrorBoundary caught error:', error);
  }

  render() {
    if (this.state.errorMessage) {
      let parsedSummary = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        if (parsed && typeof parsed.error === 'string') {
          parsedSummary = `${parsed.error}${parsed.path ? ` (path: ${parsed.path})` : ''}`;
        }
      } catch {
        // Keep raw error message
      }

      return (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <div className="flex-1">
              <h3 className="font-display text-base font-bold text-red-900">
                Cloud Storage Permission or Sync Error
              </h3>
              <p className="mt-1 text-red-800">{parsedSummary}</p>
              <button
                type="button"
                onClick={() => this.setState({ errorMessage: null })}
                className="mt-4 inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-red-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
