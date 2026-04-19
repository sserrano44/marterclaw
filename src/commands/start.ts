import type { Command } from 'commander';
import { composeStartEnv, runDockerCompose } from '../docker.js';
import { loadInstance, requireName } from '../instance.js';
import { ensureInstancesRoot } from '../paths.js';

export async function runStart(name: string | undefined): Promise<void> {
  const clawName = requireName(name);
  await ensureInstancesRoot();
  const instance = await loadInstance(clawName);

  console.log(`Starting claw '${clawName}' on port ${instance.OPENCLAW_GATEWAY_PORT}...`);
  await runDockerCompose(clawName, ['up', '-d', 'openclaw-gateway'], {
    env: composeStartEnv(instance),
    stdio: 'inherit',
  });
  console.log(`Started. Dashboard: http://localhost:${instance.OPENCLAW_GATEWAY_PORT}`);
}

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Start a claw')
    .argument('[name]')
    .action(async (name: string | undefined) => {
      await runStart(name);
    });
}
