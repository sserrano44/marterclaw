import type { Command } from 'commander';
import { loadInstance, requireName } from '../instance.js';
import { ensureInstancesRoot } from '../paths.js';

export async function runUrl(name: string | undefined): Promise<void> {
  const clawName = requireName(name);
  await ensureInstancesRoot();
  const instance = await loadInstance(clawName);
  console.log(`http://localhost:${instance.OPENCLAW_GATEWAY_PORT}`);
}

export function registerUrlCommand(program: Command): void {
  program
    .command('url')
    .description('Print the dashboard URL for a claw')
    .argument('[name]')
    .action(async (name: string | undefined) => {
      await runUrl(name);
    });
}
