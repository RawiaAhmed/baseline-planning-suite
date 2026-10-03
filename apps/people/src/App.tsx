import type { ShellContext } from '@baseline/contracts';

/** Exposed as `people/App`. Same component standalone and inside the shell. */
export default function App({ currency, activeUser }: ShellContext) {
  return (
    <section>
      <h1>People</h1>
      <p>
        Signed in as {activeUser.name}, showing costs in {currency}.
      </p>
    </section>
  );
}
