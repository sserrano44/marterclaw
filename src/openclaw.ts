import { stat } from 'node:fs/promises';
import { execa } from 'execa';
import { getPaths } from './paths.js';

export const DEFAULT_OPENCLAW_IMAGE =
  process.env.MASTERCLAW_DEFAULT_OPENCLAW_IMAGE || 'ghcr.io/openclaw/openclaw:latest';

export const OPENCLAW_GIT_HTTPS_URL = 'https://github.com/openclaw/openclaw.git';
const OPENCLAW_GIT_SSH_URL = 'git@github.com:openclaw/openclaw.git';
const OPENCLAW_GIT_ALT_SSH_URL = 'ssh://git@github.com/openclaw/openclaw.git';

export async function hasOpenclawSupportRepo(): Promise<boolean> {
  try {
    const stats = await stat(getPaths().openclawDir);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export async function ensureOpenclawSupportRepo(): Promise<void> {
  const paths = getPaths();
  if (await hasOpenclawSupportRepo()) {
    return;
  }

  console.log(`Cloning openclaw support files into ${paths.openclawDir}...`);
  await execa('git', ['clone', '--depth', '1', OPENCLAW_GIT_HTTPS_URL, paths.openclawDir], {
    stdio: 'inherit',
  });
}

export async function refreshOpenclawSupportRepo(): Promise<void> {
  const paths = getPaths();
  await ensureOpenclawSupportRepo();

  const remoteResult = await execa('git', ['-C', paths.openclawDir, 'remote', 'get-url', 'origin'], {
    reject: false,
    stdio: 'pipe',
  });

  const remoteUrl = remoteResult.stdout.trim();
  if (
    remoteUrl === OPENCLAW_GIT_SSH_URL ||
    remoteUrl === OPENCLAW_GIT_ALT_SSH_URL ||
    remoteUrl === OPENCLAW_GIT_HTTPS_URL
  ) {
    await execa('git', ['-C', paths.openclawDir, 'remote', 'set-url', 'origin', OPENCLAW_GIT_HTTPS_URL], {
      stdio: 'inherit',
    });
  }

  await execa('git', ['-C', paths.openclawDir, 'pull', '--ff-only'], {
    stdio: 'inherit',
  });
}

export async function pullReleasedOpenclawImage(image = DEFAULT_OPENCLAW_IMAGE): Promise<void> {
  await execa('docker', ['pull', image], {
    stdio: 'inherit',
  });
}

export async function buildLocalOpenclawImage(): Promise<void> {
  const paths = getPaths();
  await execa('docker', ['build', '-t', 'openclaw:local', paths.openclawDir], {
    env: { ...process.env, DOCKER_BUILDKIT: '1' },
    stdio: 'inherit',
  });
}
