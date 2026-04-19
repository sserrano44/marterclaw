import type { Command } from 'commander';
import { composeBaseEnv, runDockerCompose } from '../docker.js';
import { loadInstance, requireName } from '../instance.js';
import { ensureInstancesRoot } from '../paths.js';

export async function runShell(name: string | undefined): Promise<void> {
  const clawName = requireName(name);
  await ensureInstancesRoot();
  const instance = await loadInstance(clawName);

  await runDockerCompose(clawName, ['exec', 'openclaw-gateway', 'bash'], {
    env: composeBaseEnv(instance),
    stdio: 'inherit',
  });
}

export function registerShellCommand(program: Command): void {
  program
    .command('shell')
    .description('Open an interactive bash shell in the gateway container')
    .argument('[name]')
    .action(async (name: string | undefined) => {
      await runShell(name);
    });
}
