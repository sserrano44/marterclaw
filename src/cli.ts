import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerListCommand } from './commands/list.js';
import { registerAddCommand } from './commands/add.js';
import { registerCreateCommand } from './commands/create.js';
import { registerImportCommand } from './commands/import.js';
import { registerSetupCommand } from './commands/setup.js';
import { registerStartCommand } from './commands/start.js';
import { registerStopCommand } from './commands/stop.js';
import { registerRestartCommand } from './commands/restart.js';
import { registerStatusCommand } from './commands/status.js';
import { registerLogsCommand } from './commands/logs.js';
import { registerExecCommand } from './commands/exec.js';
import { registerShellCommand } from './commands/shell.js';
import { registerUpdateCommand } from './commands/update.js';
import { registerRemoveCommand } from './commands/remove.js';
import { registerTokenCommand } from './commands/token.js';
import { registerUrlCommand } from './commands/url.js';

function handleError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('masterclaw')
    .usage('<command> [name] [options]')
    .description('Wake me when you need me.');

  registerInitCommand(program);
  registerListCommand(program);
  registerAddCommand(program);
  registerCreateCommand(program);
  registerImportCommand(program);
  registerSetupCommand(program);
  registerStartCommand(program);
  registerStopCommand(program);
  registerRestartCommand(program);
  registerStatusCommand(program);
  registerLogsCommand(program);
  registerExecCommand(program);
  registerShellCommand(program);
  registerUpdateCommand(program);
  registerRemoveCommand(program);
  registerTokenCommand(program);
  registerUrlCommand(program);

  program.on('command:*', () => {
    const [unknownCommand] = program.args;
    console.error(`Unknown command: ${unknownCommand}`);
    console.error('');
    program.outputHelp();
    process.exit(1);
  });

  if (process.argv.length <= 2) {
    program.outputHelp();
    process.exit(0);
  }

  await program.parseAsync(process.argv);
}

main().catch(handleError);
