import { readFile } from 'node:fs/promises';

export async function readGatewayTokenFromOpenclawJson(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(content) as {
      gateway?: { auth?: { token?: unknown } };
    };
    const token = parsed.gateway?.auth?.token;
    return typeof token === 'string' ? token.trim() : '';
  } catch {
    return '';
  }
}
