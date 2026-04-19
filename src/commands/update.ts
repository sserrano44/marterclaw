import type { Command } from 'commander';
import { execa } from 'execa';
import { loadInstance, requireName } from '../instance.js';
import { ensureInstancesRoot, getPaths } from '../paths.js';
import { runDockerCompose } from '../docker.js';
import { runStart } from './start.js';
import { runStop } from './stop.js';

export async function runUpdate(name: string | undefined): Promise<void> {
  const clawName = requireName(name);
  await ensureInstancesRoot();
  const instance = await loadInstance(clawName);
  const paths = getPaths();

  console.log(`Updating openclaw for claw '${clawName}'...`);

  if (instance.OPENCLAW_IMAGE === 'openclaw:local') {
    console.log('==> Pulling latest openclaw source...');
    await execa('git', ['-C', paths.openclawDir, 'pull'], { stdio: 'inherit' });

    console.log('==> Rebuilding image...');
    await runDockerCompose(clawName, ['build', 'openclaw-gateway'], {
      stdio: 'inherit',
    });
  } else {
    console.log(`==> Pulling updated image: ${instance.OPENCLAW_IMAGE}`);
    await execa('docker', ['pull', instance.OPENCLAW_IMAGE], { stdio: 'inherit' });
  }

  console.log(`==> Restarting claw '${clawName}'...`);
  await runStop(clawName);
  await runStart(clawName);

  console.log('Done.');
}

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Rebuild/pull the openclaw image and restart the claw')
    .argument('[name]')
    .action(async (name: string | undefined) => {
      await runUpdate(name);
    });
}
