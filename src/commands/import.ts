import { mkdir, stat } from 'node:fs/promises';
import type { Command } from 'commander';
import { ensureInstancesRoot, getDefaultConfigDir, getDefaultWorkspaceDir } from '../paths.js';
import { requireName } from '../instance.js';
import {
  extractTarArchive,
  findOpenclawJsonPath,
  getStripComponentsFromOpenclawJsonPath,
  listTarEntries,
} from '../util/tarArchive.js';
import { runAdd, type AddCommandOptions } from './add.js';

export interface ImportCommandOptions extends AddCommandOptions {}

export async function runImport(
  name: string | undefined,
  backupFile: string | undefined,
  options: ImportCommandOptions,
): Promise<void> {
  const clawName = requireName(name);
  await ensureInstancesRoot();

  if (!backupFile) {
    throw new Error('backup file required. Usage: masterclaw import <name> <backup.tar.gz>');
  }

  try {
    const backupStats = await stat(backupFile);
    if (!backupStats.isFile()) {
      throw new Error('not a file');
    }
  } catch {
    throw new Error(`backup file not found: ${backupFile}`);
  }

  const configDir = options.config || getDefaultConfigDir(clawName);
  const workspaceDir = options.workspace || getDefaultWorkspaceDir(clawName);

  const entries = await listTarEntries(backupFile);
  const openclawJsonPath = findOpenclawJsonPath(entries);
  if (openclawJsonPath === '') {
    throw new Error('No openclaw.json found in backup - is this a valid openclaw backup?');
  }

  const stripComponents = getStripComponentsFromOpenclawJsonPath(openclawJsonPath);

  console.log(`==> Extracting backup into ${configDir}...`);
  await mkdir(configDir, { recursive: true });
  await extractTarArchive(backupFile, configDir, stripComponents);
  console.log('    Done.');

  console.log('');
  await runAdd(clawName, {
    config: configDir,
    workspace: workspaceDir,
    port: options.port,
    image: options.image,
  });

  console.log('');
  console.log('Import complete. Start with:');
  console.log(`  masterclaw start ${clawName}`);
}

export function registerImportCommand(program: Command): void {
  program
    .command('import')
    .description('Restore a claw from an openclaw backup archive')
    .argument('[name]')
    .argument('[backupFile]')
    .option('--config <dir>', 'Config directory')
    .option('--workspace <dir>', 'Workspace directory')
    .option('--port <port>', 'Gateway port')
    .option('--image <image>', 'OpenClaw image')
    .action(async (name: string | undefined, backupFile: string | undefined, options: ImportCommandOptions) => {
      await runImport(name, backupFile, options);
    });
}
