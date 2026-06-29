import * as http from 'node:http';
import * as https from 'node:https';
import * as tls from 'node:tls';
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

/**
 * Node.js varsayılan `fetch` üniversite sertifika zincirini doğrulayamayabilir
 * (UNABLE_TO_VERIFY_LEAF_SIGNATURE). Windows/macOS sistem CA deposu burada kullanılır.
 */
function resolveTlsOptions(tlsInsecure?: boolean): https.RequestOptions {
  if (tlsInsecure) {
    return { rejectUnauthorized: false };
  }

  try {
    const systemCerts = tls.getCACertificates('system') ?? [];
    const defaultCerts = tls.getCACertificates('default') ?? [];
    const merged = [...defaultCerts, ...systemCerts];
    if (merged.length > 0) {
      return { ca: merged };
    }
  } catch {
    // Node < 19.6: getCACertificates yoksa varsayılan TLS davranışı
  }

  return {};
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
