import type { Command } from 'commander';
import { ensureInstancesRoot } from '../paths.js';
import { listRegisteredInstances } from '../instance.js';
import { getGatewayContainerId } from '../docker.js';

function formatRow(columns: string[]): string {
  const widths = [15, 8, 8, 12, 40];
  return columns.map((column, index) => column.padEnd(widths[index] ?? column.length)).join(' ');
}

export async function runList(): Promise<void> {
  await ensureInstancesRoot();
  const instances = await listRegisteredInstances();

  if (instances.length === 0) {
    console.log('No claws registered. Use: masterclaw add <name>');
    return;
  }

  console.log(formatRow(['NAME', 'G-PORT', 'B-PORT', 'STATUS', 'CONFIG_DIR']));
  console.log(formatRow(['----', '------', '------', '------', '----------']));

  for (const instance of instances) {
    const status = (await getGatewayContainerId(instance.CLAW_NAME)) !== '' ? 'running' : 'stopped';
    console.log(
      formatRow([
        instance.CLAW_NAME,
        instance.OPENCLAW_GATEWAY_PORT,
        instance.OPENCLAW_BRIDGE_PORT,
        status,
        instance.OPENCLAW_CONFIG_DIR,
      ]),
    );
  }
}

export function registerListCommand(program: Command): void {
  program.command('list').description('List all registered claws and their status').action(runList);
}
