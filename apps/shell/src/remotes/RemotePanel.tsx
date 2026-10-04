import type { ShellContext } from '@baseline/contracts';
import { lazy, Suspense, useMemo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { loadRemoteApp, type RemoteName } from './loadRemote';

interface Props {
  readonly name: RemoteName;
  readonly title: string;
  readonly context: ShellContext;
}

/**
 * Shows one remote. If it fails to load or crashes while rendering, only this
 * panel shows an error; the shell and the other remote keep working.
 */
export function RemotePanel({ name, title, context }: Props) {
  const RemoteApp = useMemo(() => lazy(() => loadRemoteApp(name)), [name]);

  return (
    <ErrorBoundary
      resetKeys={[name]}
      fallbackRender={({ error }) => (
        <div role="alert" className="remote-error">
          <h2>{title} is unavailable</h2>
          <p>The {title} app could not be loaded. The rest of Baseline still works.</p>
          <pre>{error instanceof Error ? error.message : String(error)}</pre>
          {/* Reloads without any ?break= switch, so a fixed or restarted remote loads again. */}
          <button type="button" onClick={() => window.location.assign(window.location.pathname)}>
            Try again
          </button>
        </div>
      )}
    >
      <Suspense fallback={<p>Loading {title}…</p>}>
        <RemoteApp {...context} />
      </Suspense>
    </ErrorBoundary>
  );
}
