import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { request } from 'undici';
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
  const filePath = path.resolve(extraEndpointsFile);
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

export async function performTxMulticast(
  txData: Buffer,
  contentType: string | undefined
) {
  const extraTxPostEndpoints = await getExtraTxPostEndpoints();
  if (!extraTxPostEndpoints) {
    return;
  }
  const mutlicastPromises = extraTxPostEndpoints.map(async (endpoint) => {
    try {
      let url = endpoint;
      if (!endpoint.startsWith('http://') || !endpoint.startsWith('https://')) {
        url = `http://${endpoint}`;
      }
      let parsedUrl = new URL(url);
      if (parsedUrl.pathname === '/') {
        parsedUrl = new URL('/v2/transactions', parsedUrl);
      }
      await request(parsedUrl, {
        method: 'POST',
        body: txData,
        headers: {
          'Content-Type': contentType,
        },
        throwOnError: true,
      });
    } catch (error) {
      logger.warn(
        error,
        `Error performing tx-multicast to ${endpoint}: ${error}`
      );
    }
  });
  await Promise.allSettled(mutlicastPromises);
}
