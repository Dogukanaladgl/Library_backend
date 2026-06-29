import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import * as tls from 'node:tls';
import * as path from 'node:path';
import { URL } from 'node:url';

export interface SelcukHttpResponse {
  status: number;
  text: string;
}

export interface SelcukHttpRequestOptions {
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  /** Yalnızca geliştirme / acil durum — üretimde kullanmayın */
  tlsInsecure?: boolean;
}

const EXTRA_CA_BUNDLE = path.join(process.cwd(), 'certs', 'selcuk-api-ca.pem');

let cachedExtraCa: Buffer[] | null | undefined;

function loadExtraCaCerts(): Buffer[] {
  if (cachedExtraCa !== undefined) {
    return cachedExtraCa ?? [];
  }
  try {
    if (fs.existsSync(EXTRA_CA_BUNDLE)) {
      cachedExtraCa = [fs.readFileSync(EXTRA_CA_BUNDLE)];
      return cachedExtraCa;
    }
  } catch {
    // bundle yoksa varsayılan TLS davranışı
  }
  cachedExtraCa = null;
  return [];
}

/**
 * apiservices.selcuk.edu.tr ara sertifikasını TLS handshake'te göndermiyor;
 * Node.js Sectigo R36/R46 zincirini varsayılan CA deposunda bulamayınca
 * "unable to verify the first certificate" hatası verir.
 */
function resolveTlsOptions(tlsInsecure?: boolean): https.RequestOptions {
  if (tlsInsecure) {
    return { rejectUnauthorized: false };
  }

  const extraCa = loadExtraCaCerts();
  if (extraCa.length === 0) {
    return {};
  }

  try {
    const defaultCerts = tls.getCACertificates('default') ?? [];
    const systemCerts = tls.getCACertificates('system') ?? [];
    return { ca: [...defaultCerts, ...systemCerts, ...extraCa] };
  } catch {
    return { ca: extraCa };
  }
}

export function selcukHttpRequest(
  url: string,
  options: SelcukHttpRequestOptions,
): Promise<SelcukHttpResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const requestOptions: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: `${parsed.pathname}${parsed.search}`,
      method: options.method,
      headers: options.headers,
      ...(isHttps ? resolveTlsOptions(options.tlsInsecure) : {}),
    };

    const req = transport.request(requestOptions, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, text: data });
      });
    });

    req.on('error', (err) => reject(err));

    req.setTimeout(options.timeoutMs, () => {
      req.destroy(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}
