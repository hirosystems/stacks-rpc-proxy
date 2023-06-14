import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { ENV, logger } from './util';

export function isTxMulticastEnabled(): boolean {
  const extraEndpointsFile = ENV.STACKS_API_EXTRA_TX_ENDPOINTS_FILE;
  return (
    extraEndpointsFile !== undefined && extraEndpointsFile.trim().length !== 0
  );
}

/**
 * Check for any extra endpoints that have been configured for performing a "multicast" for a tx submission.
 */
async function getExtraTxPostEndpoints(): Promise<string[] | false> {
  const extraEndpointsFile = ENV.STACKS_API_EXTRA_TX_ENDPOINTS_FILE;
  if (!extraEndpointsFile) {
    return false;
  }
  const filePath = path.resolve(__dirname, extraEndpointsFile);
  let fileContents: string;
  try {
    fileContents = await fs.readFile(filePath, { encoding: 'utf8' });
  } catch (error) {
    logger.error(`Error reading ${extraEndpointsFile}: ${error}`, error);
    return false;
  }
  const endpoints = fileContents
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => !r.startsWith('#') && r.length !== 0);
  if (endpoints.length === 0) {
    return false;
  }
  return endpoints;
}
