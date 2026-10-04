import type { ShellContext } from '@baseline/contracts';
import { loadRemote, registerRemotes } from '@module-federation/enhanced/runtime';
import type { ComponentType } from 'react';

export type RemoteName = 'people' | 'delivery';

interface RuntimeConfig {
  remotes: Record<RemoteName, string>;
}

/**
 * Reads remote URLs from /config.json (written by the container at start-up)
 * and registers them with Module Federation. Nothing about remote locations is in the bundle.
 *
 * `?break=people` (or `delivery`) points that remote at a URL that does not exist,
 * to show the shell surviving a failed remote.
 */
export async function registerRemotesFromConfig(): Promise<void> {
  const config = (await (await fetch('/config.json')).json()) as RuntimeConfig;
  const broken = new URLSearchParams(window.location.search).get('break');

  registerRemotes(
    Object.entries(config.remotes).map(([name, entry]) => ({
      name,
      entry: name === broken ? `${entry}.broken` : entry,
    })),
  );
}

/** Loads a remote's exposed `./App` component. Rejects if the remote cannot be reached. */
export async function loadRemoteApp(name: RemoteName): Promise<{ default: ComponentType<ShellContext> }> {
  const module = await loadRemote<{ default: ComponentType<ShellContext> }>(`${name}/App`);
  if (!module) throw new Error(`Remote "${name}" returned nothing`);
  return module;
}
