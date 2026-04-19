import type { Command } from 'commander';
import { ensureInstancesRoot, getDefaultConfigDir, getDefaultWorkspaceDir } from '../paths.js';
import { registerInstance, requireName } from '../instance.js';

export interface AddCommandOptions {
  config?: string;
  workspace?: string;
  port?: string;
  image?: string;
}

export async function runAdd(name: string | undefined, options: AddCommandOptions): Promise<void> {
  const clawName = requireName(name);
  await ensureInstancesRoot();

  const instance = await registerInstance(clawName, {
    configDir: options.config || getDefaultConfigDir(clawName),
    workspaceDir: options.workspace || getDefaultWorkspaceDir(clawName),
    port: options.port,
    image: options.image,
  });

  console.log(`Registered claw '${clawName}'`);
  console.log(`  Config:    ${instance.OPENCLAW_CONFIG_DIR}`);
  console.log(`  Workspace: ${instance.OPENCLAW_WORKSPACE_DIR}`);
  console.log(
    `  Gateway:   http://localhost:${instance.OPENCLAW_GATEWAY_PORT}  (token: ${instance.OPENCLAW_GATEWAY_TOKEN})`,
  );
  console.log('');
  console.log('Next steps:');
  console.log(`  masterclaw setup ${clawName}    # interactive onboarding (first time)`);
  console.log(`  masterclaw start ${clawName}    # start the gateway`);
}

export function registerAddCommand(program: Command): void {
  program
    .command('add')
    .description('Register a new claw instance')
    .argument('[name]')
    .option('--config <dir>', 'Config directory')
    .option('--workspace <dir>', 'Workspace directory')
    .option('--port <port>', 'Gateway port')
    .option('--image <image>', 'OpenClaw image')
    .action(async (name: string | undefined, options: AddCommandOptions) => {
      await runAdd(name, options);
    });
}
