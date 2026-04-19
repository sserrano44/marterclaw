import type { Command } from 'commander';
import { composeBaseEnv, runDockerCompose } from '../docker.js';
import { loadInstance, requireName } from '../instance.js';
import { ensureInstancesRoot } from '../paths.js';

export interface StopCommandOptions {
  suppressComposeStderr?: boolean;
}

export async function runStop(name: string | undefined, options: StopCommandOptions = {}): Promise<void> {
  const clawName = requireName(name);
  await ensureInstancesRoot();
  const instance = await loadInstance(clawName);

  console.log(`Stopping claw '${clawName}'...`);
  await runDockerCompose(clawName, ['down'], {
    env: composeBaseEnv(instance),
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: options.suppressComposeStderr ? 'ignore' : 'inherit',
  });
  console.log('Stopped.');
}

export function registerStopCommand(program: Command): void {
  program
    .command('stop')
    .description('Stop a claw')
    .argument('[name]')
    .action(async (name: string | undefined) => {
      await runStop(name);
    });
}
