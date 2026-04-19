import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type EnvFileRecord = Record<string, string>;

function parseValue(rawValue: string): string {
  const value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function parseEnvFile(content: string): EnvFileRecord {
  const values: EnvFileRecord = {};

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);
    if (key !== '') {
      values[key] = parseValue(value);
    }
  }

  return values;
}

export async function readEnvFile(filePath: string): Promise<EnvFileRecord> {
  const content = await readFile(filePath, 'utf8');
  return parseEnvFile(content);
}

export function serializeEnvFile(entries: Iterable<[string, string]>): string {
  return `${Array.from(entries, ([key, value]) => `${key}=${value}`).join('\n')}\n`;
}

export async function writeEnvFile(filePath: string, entries: Iterable<[string, string]>): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, serializeEnvFile(entries), 'utf8');
}
