import type { Command } from 'commander';
import { runStart } from './start.js';
import { runStop } from './stop.js';

export async function runRestart(name: string | undefined): Promise<void> {
  await runStop(name);
  await runStart(name);
}

export function registerRestartCommand(program: Command): void {
  program
    .command('restart')
    .description('Restart a claw')
    .argument('[name]')
    .action(async (name: string | undefined) => {
      await runRestart(name);
    });
}
