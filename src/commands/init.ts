import { stat } from 'node:fs/promises';
import { execa } from 'execa';
import type { Command } from 'commander';
import { getPaths } from '../paths.js';

export async function runInit(): Promise<void> {
  const paths = getPaths();

  try {
    const stats = await stat(paths.openclawDir);
    if (stats.isDirectory()) {
      console.log(`openclaw already present at ${paths.openclawDir}`);
    }
  } catch {
    console.log(`Cloning openclaw into ${paths.openclawDir}...`);
    await execa('git', ['clone', 'git@github.com:openclaw/openclaw.git', paths.openclawDir], {
      stdio: 'inherit',
    });
  }

  console.log('Building Docker image (openclaw:local)...');
  await execa('docker', ['build', '-t', 'openclaw:local', paths.openclawDir], {
    env: { ...process.env, DOCKER_BUILDKIT: '1' },
    stdio: 'inherit',
  });

  console.log('');
  console.log('Done. openclaw is ready. Next:');
  console.log('  masterclaw create <name>    # create your first claw');
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Clone openclaw repo and build the Docker image')
    .action(async () => {
      await runInit();
    });
}
