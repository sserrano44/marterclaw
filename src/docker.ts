import { execa } from 'execa';
import { getPaths } from './paths.js';
import type { InstanceEnv } from './instance.js';

type ExecaOptions = Parameters<typeof execa>[2];

export function composeProjectName(name: string): string {
  return `claw-${name}`;
}

export function composeArgs(name: string, args: string[]): string[] {
  return ['compose', '-f', getPaths().composeFile, '--project-name', composeProjectName(name), ...args];
}

export function composeBaseEnv(instance: InstanceEnv): Record<string, string> {
  return {
    OPENCLAW_CONFIG_DIR: instance.OPENCLAW_CONFIG_DIR,
    OPENCLAW_WORKSPACE_DIR: instance.OPENCLAW_WORKSPACE_DIR,
    OPENCLAW_GATEWAY_PORT: instance.OPENCLAW_GATEWAY_PORT,
    OPENCLAW_BRIDGE_PORT: instance.OPENCLAW_BRIDGE_PORT,
    OPENCLAW_GATEWAY_TOKEN: instance.OPENCLAW_GATEWAY_TOKEN,
    OPENCLAW_IMAGE: instance.OPENCLAW_IMAGE,
  };
}

export function composeStartEnv(instance: InstanceEnv): Record<string, string> {
  return {
    ...composeBaseEnv(instance),
    OPENCLAW_GATEWAY_BIND: instance.OPENCLAW_GATEWAY_BIND,
    OPENCLAW_SANDBOX: instance.OPENCLAW_SANDBOX,
    OPENCLAW_TZ: instance.OPENCLAW_TZ || 'UTC',
    OPENCLAW_EXTRA_MOUNTS: instance.OPENCLAW_EXTRA_MOUNTS,
    OPENCLAW_HOME_VOLUME: instance.OPENCLAW_HOME_VOLUME,
    OPENCLAW_DOCKER_APT_PACKAGES: instance.OPENCLAW_DOCKER_APT_PACKAGES,
    OPENCLAW_EXTENSIONS: instance.OPENCLAW_EXTENSIONS,
    OPENCLAW_ALLOW_INSECURE_PRIVATE_WS: instance.OPENCLAW_ALLOW_INSECURE_PRIVATE_WS,
    DOCKER_GID: instance.DOCKER_GID || '',
  };
}

export function setupEnv(instance: InstanceEnv): Record<string, string> {
  return {
    ...composeStartEnv(instance),
    OPENCLAW_TZ: instance.OPENCLAW_TZ,
  };
}

export async function runDockerCompose(
  name: string,
  args: string[],
  options: ExecaOptions & { env?: Record<string, string> } = {},
) {
  const env = { ...process.env, ...options.env };
  return execa('docker', composeArgs(name, args), { ...options, env });
}

export async function getGatewayContainerId(name: string): Promise<string> {
  try {
    const result = await runDockerCompose(name, ['ps', '--quiet', 'openclaw-gateway'], {
      reject: false,
      stdio: 'pipe',
    });

    return result.stdout.trim();
  } catch {
    return '';
  }
}
