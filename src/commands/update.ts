import type { Command } from 'commander';
import { loadInstance, requireName } from '../instance.js';
import { ensureInstancesRoot } from '../paths.js';
import { pullReleasedOpenclawImage, refreshOpenclawSupportRepo } from '../openclaw.js';
import { runDockerCompose } from '../docker.js';
import { runStart } from './start.js';
import { runStop } from './stop.js';

export async function runUpdate(name: string | undefined): Promise<void> {
  const clawName = requireName(name);
  await ensureInstancesRoot();
  const instance = await loadInstance(clawName);

  console.log(`Updating openclaw for claw '${clawName}'...`);
  console.log('==> Refreshing openclaw support files...');
  await refreshOpenclawSupportRepo();

  if (instance.OPENCLAW_IMAGE === 'openclaw:local') {
    console.log('==> Rebuilding image...');
    await runDockerCompose(clawName, ['build', 'openclaw-gateway'], {
      stdio: 'inherit',
    });
  } else {
    console.log(`==> Pulling updated image: ${instance.OPENCLAW_IMAGE}`);
    await pullReleasedOpenclawImage(instance.OPENCLAW_IMAGE);
  }

  console.log(`==> Restarting claw '${clawName}'...`);
  await runStop(clawName);
  await runStart(clawName);

  console.log('Done.');
}

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Refresh support files, rebuild/pull the image, and restart the claw')
    .argument('[name]')
    .action(async (name: string | undefined) => {
      await runUpdate(name);
    });
}
