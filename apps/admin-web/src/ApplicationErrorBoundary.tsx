import React from 'react';

type State = { hasError: boolean };

export class ApplicationErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <section role="alert" className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-xl">
          <h1 className="text-lg font-bold">Admin page could not be displayed</h1>
          <p className="mt-2 text-sm text-slate-400">Reload the page to try again. Your saved account and pricing data have not been changed.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold">Reload page</button>
        </section>
      </main>;
    }

    return this.props.children;
  }
}
