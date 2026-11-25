import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { logError } from '@/lib/log';

interface AppErrorBoundaryState {
  failed: boolean;
}

/** Last resort around the whole app: a plain page with a Reload button. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logError('app crashed', { error, componentStack: info.componentStack });
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto flex min-h-dvh max-w-[960px] flex-col items-start justify-center gap-4 px-8">
        <p className="text-[22px] font-medium text-ink">Something went wrong. Reload the page.</p>
        <Button
          type="button"
          onClick={() => window.location.reload()}
          className="h-11 rounded-none bg-cover px-5 text-[15px] font-semibold text-white hover:bg-[#173d2e]"
        >
          Reload
        </Button>
      </main>
    );
  }
}

interface EntryErrorBoundaryProps {
  children: ReactNode;
  /** True when the failing view is a chart; the fallback then offers the table. */
  chartShown: boolean;
  onShowTable: () => void;
  /** Changing this (e.g. switching view) clears the error and renders the children again. */
  resetKey: string;
}

interface EntryErrorBoundaryState {
  failed: boolean;
  resetKey: string;
}

/** Around each answer, so one broken chart or table doesn't take down the page. */
export class EntryErrorBoundary extends Component<
  EntryErrorBoundaryProps,
  EntryErrorBoundaryState
> {
  override state: EntryErrorBoundaryState = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<EntryErrorBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: EntryErrorBoundaryProps,
    state: EntryErrorBoundaryState,
  ): Partial<EntryErrorBoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logError('answer failed to render', { error, componentStack: info.componentStack });
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[15px] text-ink">This answer couldn&rsquo;t be displayed.</p>
        {this.props.chartShown && (
          <Button
            type="button"
            variant="outline"
            onClick={this.props.onShowTable}
            className="h-9 rounded-none border-ink/70 bg-transparent px-3 text-[15px] text-ink hover:bg-cover-wash/60"
          >
            Show table
          </Button>
        )}
      </div>
    );
  }
}
