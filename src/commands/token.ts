import type { Command } from 'commander';
import { loadInstance, requireName } from '../instance.js';
import { ensureInstancesRoot } from '../paths.js';

export async function runToken(name: string | undefined): Promise<void> {
  const clawName = requireName(name);
  await ensureInstancesRoot();
  const instance = await loadInstance(clawName);
  console.log(instance.OPENCLAW_GATEWAY_TOKEN);
}

export function registerTokenCommand(program: Command): void {
  program
    .command('token')
    .description('Print the gateway token for a claw')
    .argument('[name]')
    .action(async (name: string | undefined) => {
      await runToken(name);
    });
}
