import path from 'node:path';
import { execa } from 'execa';

export async function listTarEntries(archivePath: string): Promise<string[]> {
  const { stdout } = await execa('tar', ['-tzf', archivePath]);
  return stdout.split(/\r?\n/u).filter(Boolean);
}

export function findOpenclawJsonPath(entries: string[]): string {
  return entries.find((entry) => entry.endsWith('openclaw.json')) ?? '';
}

export function getStripComponentsFromOpenclawJsonPath(openclawJsonPath: string): number {
  const parentDir = path.posix.dirname(openclawJsonPath);
  if (parentDir === '.' || parentDir === '') {
    return 0;
  }

  return parentDir.split('/').filter(Boolean).length;
}

export async function extractTarArchive(
  archivePath: string,
  destinationDir: string,
  stripComponents: number,
): Promise<void> {
  await execa(
    'tar',
    ['-xzf', archivePath, `--strip-components=${stripComponents}`, '-C', destinationDir],
    { stdio: 'inherit' },
  );
}
