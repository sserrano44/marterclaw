import type { Command } from 'commander';
import { runAdd, type AddCommandOptions } from './add.js';
import { runSetup } from './setup.js';

export async function runCreate(name: string | undefined, options: AddCommandOptions): Promise<void> {
  await runAdd(name, options);
  console.log('');
  await runSetup(name);
}

export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('Register + run docker setup in one step (add + setup)')
    .argument('[name]')
    .option('--config <dir>', 'Config directory')
    .option('--workspace <dir>', 'Workspace directory')
    .option('--port <port>', 'Gateway port')
    .action(async (name: string | undefined, options: AddCommandOptions) => {
      await runCreate(name, options);
    });
}
