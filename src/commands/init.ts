import type { Command } from 'commander';
import {
  DEFAULT_OPENCLAW_IMAGE,
  buildLocalOpenclawImage,
  ensureOpenclawSupportRepo,
  hasOpenclawSupportRepo,
  pullReleasedOpenclawImage,
} from '../openclaw.js';

export interface InitCommandOptions {
  buildLocal?: boolean;
}

export async function runInit(options: InitCommandOptions): Promise<void> {
  const alreadyPresent = await hasOpenclawSupportRepo();
  await ensureOpenclawSupportRepo();
  if (alreadyPresent) {
    console.log('openclaw support files already present');
  }

  if (options.buildLocal) {
    console.log('Building Docker image (openclaw:local)...');
    await buildLocalOpenclawImage();

    console.log('');
    console.log('Done. openclaw local source image is ready. Next:');
    console.log('  masterclaw create <name> --image openclaw:local');
    return;
  }

  console.log(`Pulling released OpenClaw image (${DEFAULT_OPENCLAW_IMAGE})...`);
  await pullReleasedOpenclawImage();

  console.log('');
  console.log('Done. released OpenClaw runtime is ready. Next:');
  console.log('  masterclaw create <name>');
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Prepare OpenClaw support files and the default runtime image')
    .option('--build-local', 'Build openclaw:local from source instead of pulling the released image')
    .action(async (options: InitCommandOptions) => {
      await runInit(options);
    });
}
