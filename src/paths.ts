import os from 'node:os';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

export interface MasterclawPaths {
  masterclawHome: string;
  configRoot: string;
  instancesRoot: string;
  openclawDir: string;
  composeFile: string;
  openclawSetupScript: string;
  clawsRoot: string;
}

export function getPaths(): MasterclawPaths {
  const masterclawHome = process.env.MASTERCLAW_HOME || path.join(os.homedir(), '.masterclaw');
  const clawsRoot = process.env.MASTERCLAW_CLAWS_DIR || path.join(os.homedir(), 'claws');
  const configRoot = path.join(masterclawHome, 'config');
  const instancesRoot = path.join(configRoot, 'instances');
  const openclawDir = path.join(masterclawHome, 'openclaw');

  return {
    masterclawHome,
    configRoot,
    instancesRoot,
    openclawDir,
    composeFile: path.join(openclawDir, 'docker-compose.yml'),
    openclawSetupScript: path.join(openclawDir, 'scripts', 'docker', 'setup.sh'),
    clawsRoot,
  };
}

export function getInstanceDir(name: string): string {
  return path.join(getPaths().instancesRoot, name);
}

export function getInstanceEnvFile(name: string): string {
  return path.join(getInstanceDir(name), 'env');
}

export function getDefaultConfigDir(name: string): string {
  return path.join(getPaths().clawsRoot, name);
}

export function getDefaultWorkspaceDir(name: string): string {
  return path.join(getDefaultConfigDir(name), 'workspace');
}

export function getOpenclawJsonPath(configDir: string): string {
  return path.join(configDir, 'openclaw.json');
}

export async function ensureInstancesRoot(): Promise<void> {
  await mkdir(getPaths().instancesRoot, { recursive: true });
}
