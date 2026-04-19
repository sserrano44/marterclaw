import type { Command } from 'commander';
import { execa } from 'execa';
import { composeProjectName, setupEnv } from '../docker.js';
import { loadInstance, requireName } from '../instance.js';
import { ensureInstancesRoot, getPaths } from '../paths.js';

export async function runSetup(name: string | undefined): Promise<void> {
  const clawName = requireName(name);
  await ensureInstancesRoot();
  const instance = await loadInstance(clawName);
  const paths = getPaths();

  console.log(`==> Running openclaw setup for claw '${clawName}'`);
  console.log(`    Config:    ${instance.OPENCLAW_CONFIG_DIR}`);
  console.log(`    Workspace: ${instance.OPENCLAW_WORKSPACE_DIR}`);
  console.log(`    Port:      ${instance.OPENCLAW_GATEWAY_PORT}`);
  console.log('');

  await execa('bash', [paths.openclawSetupScript], {
    cwd: paths.openclawDir,
    env: {
      ...process.env,
      ...setupEnv(instance),
      COMPOSE_PROJECT_NAME: composeProjectName(clawName),
    },
    stdio: 'inherit',
  });
}

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description('Run openclaw docker setup (interactive onboarding)')
    .argument('[name]')
    .action(async (name: string | undefined) => {
      await runSetup(name);
    });
}
