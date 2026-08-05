import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <p className="text-lg font-display font-bold text-foreground">Terjadi kesalahan</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-md break-words">
          {this.state.error.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition"
        >
          Muat Ulang
        </button>
      </div>
    );
  }
}
