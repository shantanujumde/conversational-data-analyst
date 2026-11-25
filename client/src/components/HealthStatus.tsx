import type { Health } from '@cda/shared';
import { useEffect, useState } from 'react';
import { type ApiResult, getHealth } from '../api/client';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; health: Health; checkedAt: Date }
  | { kind: 'error'; message: string };

function toState(result: ApiResult<Health>): State {
  return result.ok
    ? { kind: 'ok', health: result.data, checkedAt: new Date() }
    : { kind: 'error', message: result.error.message };
}

export function HealthStatus() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  // First check on mount. `ignore` drops the result if the component unmounts first.
  useEffect(() => {
    let ignore = false;
    void getHealth().then((result) => {
      if (!ignore) setState(toState(result));
    });
    return () => {
      ignore = true;
    };
  }, []);

  async function checkAgain() {
    setState({ kind: 'loading' });
    setState(toState(await getHealth()));
  }

  return (
    <section className="health" aria-live="polite">
      {state.kind === 'loading' && <p>Checking server…</p>}

      {state.kind === 'ok' && (
        <>
          <p className="health-title">
            {state.health.status === 'ok' ? (
              <>
                <span className="dot dot-ok" aria-hidden="true" /> Server OK
              </>
            ) : (
              <>
                <span className="dot dot-error" aria-hidden="true" /> Server degraded
              </>
            )}
          </p>
          <dl className="health-details">
            <dt>Version</dt>
            <dd>{state.health.version}</dd>
            <dt>Uptime</dt>
            <dd>{state.health.uptimeSeconds}s</dd>
            <dt>Last checked</dt>
            <dd>{state.checkedAt.toLocaleTimeString()}</dd>
          </dl>
        </>
      )}

      {state.kind === 'error' && (
        <p className="health-title">
          <span className="dot dot-error" aria-hidden="true" /> {state.message}
        </p>
      )}

      <button type="button" onClick={() => void checkAgain()} disabled={state.kind === 'loading'}>
        Check again
      </button>
    </section>
  );
}
