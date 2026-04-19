import type { Command } from 'commander';
import { composeBaseEnv, runDockerCompose } from '../docker.js';
import { loadInstance, requireName } from '../instance.js';
import { ensureInstancesRoot } from '../paths.js';

function rawPassthroughArgs(command: Command, name?: string): string[] {
  const [, , , ...rest] = command.rawArgs;
  if (name && rest[0] === name) {
    return rest.slice(1);
  }

  return rest;
}

export async function runExec(name: string | undefined, args: string[]): Promise<void> {
  const clawName = requireName(name);
  await ensureInstancesRoot();
  const instance = await loadInstance(clawName);

  await runDockerCompose(clawName, ['run', '--rm', 'openclaw-cli', ...args], {
    env: composeBaseEnv(instance),
    stdio: 'inherit',
  });
}

export function registerExecCommand(program: Command): void {
  program
    .command('exec')
    .description('Run openclaw CLI command inside the claw')
    .allowUnknownOption(true)
    .argument('[name]')
    .argument('[args...]')
    .action(async (name: string | undefined, _args: string[], command: Command) => {
      await runExec(name, rawPassthroughArgs(command, name));
    });
}
