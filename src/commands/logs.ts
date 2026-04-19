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

export async function runLogs(name: string | undefined, args: string[]): Promise<void> {
  const clawName = requireName(name);
  await ensureInstancesRoot();
  const instance = await loadInstance(clawName);

  await runDockerCompose(clawName, ['logs', '-f', ...(args.length > 0 ? args : ['openclaw-gateway'])], {
    env: composeBaseEnv(instance),
    stdio: 'inherit',
  });
}

export function registerLogsCommand(program: Command): void {
  program
    .command('logs')
    .description('Follow gateway logs (extra args passed to docker compose logs)')
    .allowUnknownOption(true)
    .argument('[name]')
    .argument('[args...]')
    .action(async (name: string | undefined, _args: string[], command: Command) => {
      await runLogs(name, rawPassthroughArgs(command, name));
    });
}
