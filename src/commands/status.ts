import type { Command } from 'commander';
import { composeBaseEnv, runDockerCompose } from '../docker.js';
import { loadInstance, requireName } from '../instance.js';
import { ensureInstancesRoot } from '../paths.js';

export async function runStatus(name: string | undefined): Promise<void> {
  const clawName = requireName(name);
  await ensureInstancesRoot();
  const instance = await loadInstance(clawName);

  console.log(`==> Claw: ${clawName}`);
  console.log(`    Config:    ${instance.OPENCLAW_CONFIG_DIR}`);
  console.log(`    Workspace: ${instance.OPENCLAW_WORKSPACE_DIR}`);
  console.log(`    Gateway:   http://localhost:${instance.OPENCLAW_GATEWAY_PORT}`);
  console.log(`    Bridge:    port ${instance.OPENCLAW_BRIDGE_PORT}`);
  console.log(`    Token:     ${instance.OPENCLAW_GATEWAY_TOKEN}`);
  console.log('');

  try {
    const result = await runDockerCompose(clawName, ['ps'], {
      env: composeBaseEnv(instance),
      reject: false,
      stdio: 'pipe',
    });

    if (result.stdout !== '') {
      process.stdout.write(result.stdout);
      if (!result.stdout.endsWith('\n')) {
        process.stdout.write('\n');
      }
    }
  } catch {
    // Match the shell script's "docker compose ... || true" behavior.
  }
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show status and info for a claw')
    .argument('[name]')
    .action(async (name: string | undefined) => {
      await runStatus(name);
    });
}
