import type { Command } from 'commander';
import { ensureInstancesRoot } from '../paths.js';
import { loadInstance, requireName, unregisterInstance } from '../instance.js';
import { runStop } from './stop.js';

export async function runRemove(name: string | undefined): Promise<void> {
  const clawName = requireName(name);
  await ensureInstancesRoot();
  const instance = await loadInstance(clawName);

  console.log(`Stopping claw '${clawName}' before removal...`);
  try {
    await runStop(clawName, { suppressComposeStderr: true });
  } catch {
    // Preserve the bash behavior: best-effort stop before unregistering.
  }

  await unregisterInstance(clawName);
  console.log(`Removed claw '${clawName}' from registry.`);
  console.log(`Note: config and workspace at '${instance.OPENCLAW_CONFIG_DIR}' were NOT deleted.`);
}

export function registerRemoveCommand(program: Command): void {
  program
    .command('remove')
    .description('Stop and unregister a claw (config/workspace preserved)')
    .argument('[name]')
    .action(async (name: string | undefined) => {
      await runRemove(name);
    });
}
