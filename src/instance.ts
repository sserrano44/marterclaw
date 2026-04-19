import { randomBytes } from 'node:crypto';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  ensureInstancesRoot,
  getDefaultConfigDir,
  getDefaultWorkspaceDir,
  getInstanceDir,
  getInstanceEnvFile,
  getPaths,
  getOpenclawJsonPath,
} from './paths.js';
import { DEFAULT_OPENCLAW_IMAGE } from './openclaw.js';
import { readEnvFile, writeEnvFile } from './util/envFile.js';
import { readGatewayTokenFromOpenclawJson } from './util/openclawJson.js';

export const DEFAULT_PORT_START = 18789;

export const INSTANCE_ENV_KEYS = [
  'CLAW_NAME',
  'OPENCLAW_CONFIG_DIR',
  'OPENCLAW_WORKSPACE_DIR',
  'OPENCLAW_GATEWAY_PORT',
  'OPENCLAW_BRIDGE_PORT',
  'OPENCLAW_GATEWAY_TOKEN',
  'OPENCLAW_IMAGE',
  'OPENCLAW_GATEWAY_BIND',
  'OPENCLAW_SANDBOX',
  'OPENCLAW_TZ',
  'OPENCLAW_EXTRA_MOUNTS',
  'OPENCLAW_HOME_VOLUME',
  'OPENCLAW_DOCKER_APT_PACKAGES',
  'OPENCLAW_EXTENSIONS',
  'OPENCLAW_ALLOW_INSECURE_PRIVATE_WS',
  'DOCKER_GID',
] as const;

export interface InstanceEnv {
  CLAW_NAME: string;
  OPENCLAW_CONFIG_DIR: string;
  OPENCLAW_WORKSPACE_DIR: string;
  OPENCLAW_GATEWAY_PORT: string;
  OPENCLAW_BRIDGE_PORT: string;
  OPENCLAW_GATEWAY_TOKEN: string;
  OPENCLAW_IMAGE: string;
  OPENCLAW_GATEWAY_BIND: string;
  OPENCLAW_SANDBOX: string;
  OPENCLAW_TZ: string;
  OPENCLAW_EXTRA_MOUNTS: string;
  OPENCLAW_HOME_VOLUME: string;
  OPENCLAW_DOCKER_APT_PACKAGES: string;
  OPENCLAW_EXTENSIONS: string;
  OPENCLAW_ALLOW_INSECURE_PRIVATE_WS: string;
  DOCKER_GID: string;
}

export interface AddInstanceOptions {
  configDir?: string;
  workspaceDir?: string;
  port?: string;
  image?: string;
}

const EMPTY_INSTANCE: Omit<InstanceEnv, 'CLAW_NAME'> = {
  OPENCLAW_CONFIG_DIR: '',
  OPENCLAW_WORKSPACE_DIR: '',
  OPENCLAW_GATEWAY_PORT: '',
  OPENCLAW_BRIDGE_PORT: '',
  OPENCLAW_GATEWAY_TOKEN: '',
  OPENCLAW_IMAGE: DEFAULT_OPENCLAW_IMAGE,
  OPENCLAW_GATEWAY_BIND: 'lan',
  OPENCLAW_SANDBOX: '',
  OPENCLAW_TZ: '',
  OPENCLAW_EXTRA_MOUNTS: '',
  OPENCLAW_HOME_VOLUME: '',
  OPENCLAW_DOCKER_APT_PACKAGES: '',
  OPENCLAW_EXTENSIONS: '',
  OPENCLAW_ALLOW_INSECURE_PRIVATE_WS: '',
  DOCKER_GID: '',
};

function fail(message: string): never {
  throw new Error(message);
}

export function requireName(name?: string): string {
  if (!name) {
    fail('claw name required');
  }

  return name;
}

function normalizePort(port: string): number {
  const parsed = Number.parseInt(port, 10);
  if (!Number.isInteger(parsed)) {
    fail(`invalid port: ${port}`);
  }

  return parsed;
}

function normalizeInstance(name: string, values: Record<string, string>): InstanceEnv {
  return {
    CLAW_NAME: values.CLAW_NAME || name,
    OPENCLAW_CONFIG_DIR: values.OPENCLAW_CONFIG_DIR || EMPTY_INSTANCE.OPENCLAW_CONFIG_DIR,
    OPENCLAW_WORKSPACE_DIR: values.OPENCLAW_WORKSPACE_DIR || EMPTY_INSTANCE.OPENCLAW_WORKSPACE_DIR,
    OPENCLAW_GATEWAY_PORT: values.OPENCLAW_GATEWAY_PORT || EMPTY_INSTANCE.OPENCLAW_GATEWAY_PORT,
    OPENCLAW_BRIDGE_PORT: values.OPENCLAW_BRIDGE_PORT || EMPTY_INSTANCE.OPENCLAW_BRIDGE_PORT,
    OPENCLAW_GATEWAY_TOKEN: values.OPENCLAW_GATEWAY_TOKEN || EMPTY_INSTANCE.OPENCLAW_GATEWAY_TOKEN,
    OPENCLAW_IMAGE: values.OPENCLAW_IMAGE || EMPTY_INSTANCE.OPENCLAW_IMAGE,
    OPENCLAW_GATEWAY_BIND: values.OPENCLAW_GATEWAY_BIND || EMPTY_INSTANCE.OPENCLAW_GATEWAY_BIND,
    OPENCLAW_SANDBOX: values.OPENCLAW_SANDBOX || EMPTY_INSTANCE.OPENCLAW_SANDBOX,
    OPENCLAW_TZ: values.OPENCLAW_TZ || EMPTY_INSTANCE.OPENCLAW_TZ,
    OPENCLAW_EXTRA_MOUNTS: values.OPENCLAW_EXTRA_MOUNTS || EMPTY_INSTANCE.OPENCLAW_EXTRA_MOUNTS,
    OPENCLAW_HOME_VOLUME: values.OPENCLAW_HOME_VOLUME || EMPTY_INSTANCE.OPENCLAW_HOME_VOLUME,
    OPENCLAW_DOCKER_APT_PACKAGES:
      values.OPENCLAW_DOCKER_APT_PACKAGES || EMPTY_INSTANCE.OPENCLAW_DOCKER_APT_PACKAGES,
    OPENCLAW_EXTENSIONS: values.OPENCLAW_EXTENSIONS || EMPTY_INSTANCE.OPENCLAW_EXTENSIONS,
    OPENCLAW_ALLOW_INSECURE_PRIVATE_WS:
      values.OPENCLAW_ALLOW_INSECURE_PRIVATE_WS || EMPTY_INSTANCE.OPENCLAW_ALLOW_INSECURE_PRIVATE_WS,
    DOCKER_GID: values.DOCKER_GID || EMPTY_INSTANCE.DOCKER_GID,
  };
}

export function instanceEnvEntries(instance: InstanceEnv): Array<[string, string]> {
  return INSTANCE_ENV_KEYS.map((key) => [key, instance[key]]);
}

export async function loadInstance(name: string): Promise<InstanceEnv> {
  const clawName = requireName(name);
  const envFile = getInstanceEnvFile(clawName);

  try {
    const values = await readEnvFile(envFile);
    return normalizeInstance(clawName, values);
  } catch {
    fail(`claw '${clawName}' not found. Run: masterclaw add ${clawName}`);
  }
}

export async function listRegisteredInstances(): Promise<InstanceEnv[]> {
  await ensureInstancesRoot();
  const instanceRootEntries = await readdir(getPaths().instancesRoot, {
    withFileTypes: true,
  });

  const instances: InstanceEnv[] = [];
  for (const entry of instanceRootEntries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) {
      continue;
    }

    const envFile = getInstanceEnvFile(entry.name);
    try {
      const values = await readEnvFile(envFile);
      instances.push(normalizeInstance(entry.name, values));
    } catch {
      continue;
    }
  }

  return instances;
}

export async function nextAvailablePort(): Promise<number> {
  await ensureInstancesRoot();
  const instances = await listRegisteredInstances();
  let port = DEFAULT_PORT_START;

  while (true) {
    const inUse = instances.some((instance) => {
      return (
        Number.parseInt(instance.OPENCLAW_GATEWAY_PORT, 10) === port ||
        Number.parseInt(instance.OPENCLAW_BRIDGE_PORT, 10) === port
      );
    });

    if (!inUse) {
      return port;
    }

    port += 2;
  }
}

export async function registerInstance(name: string, options: AddInstanceOptions): Promise<InstanceEnv> {
  const clawName = requireName(name);
  await ensureInstancesRoot();

  const instanceDir = getInstanceDir(clawName);
  try {
    await stat(instanceDir);
    fail(`claw '${clawName}' already registered. Use 'masterclaw remove ${clawName}' first to re-add.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  const configDir = options.configDir || getDefaultConfigDir(clawName);
  const workspaceDir = options.workspaceDir || getDefaultWorkspaceDir(clawName);
  const gatewayPort = options.port ? normalizePort(options.port) : await nextAvailablePort();
  const bridgePort = gatewayPort + 1;

  const existingToken = await readGatewayTokenFromOpenclawJson(getOpenclawJsonPath(configDir));
  const token = existingToken || randomBytes(32).toString('hex');

  await mkdir(instanceDir, { recursive: true });
  await mkdir(configDir, { recursive: true });
  await mkdir(workspaceDir, { recursive: true });
  await mkdir(path.join(configDir, 'identity'), { recursive: true });
  await mkdir(path.join(configDir, 'agents', 'main', 'agent'), { recursive: true });
  await mkdir(path.join(configDir, 'agents', 'main', 'sessions'), { recursive: true });

  const instance: InstanceEnv = {
    ...EMPTY_INSTANCE,
    CLAW_NAME: clawName,
    OPENCLAW_CONFIG_DIR: configDir,
    OPENCLAW_WORKSPACE_DIR: workspaceDir,
    OPENCLAW_GATEWAY_PORT: String(gatewayPort),
    OPENCLAW_BRIDGE_PORT: String(bridgePort),
    OPENCLAW_GATEWAY_TOKEN: token,
    OPENCLAW_IMAGE: options.image || EMPTY_INSTANCE.OPENCLAW_IMAGE,
  };

  await writeEnvFile(getInstanceEnvFile(clawName), instanceEnvEntries(instance));
  return instance;
}

export async function unregisterInstance(name: string): Promise<void> {
  await rm(getInstanceDir(name), { recursive: true, force: true });
}
