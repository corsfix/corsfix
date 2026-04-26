import tls from 'tls';
import { X509Certificate } from 'crypto';
import { request, EnvHttpProxyAgent } from 'undici';
import { Cacheable } from 'cacheable';

const cache = new Cacheable({ ttl: '24h' });
const aiaDispatcher = new EnvHttpProxyAgent();
const rootSubjects = new Set(
  tls.rootCertificates.map((p) => new X509Certificate(p).subject),
);

export async function getTlsCertificates(hostname: string): Promise<string[]> {
  const key = `tls-chain:${hostname}`;

  const extras = await cache.getOrSet<string[]>(key, async () => {
    try {
      // 1. Open TLS connection to grab whatever cert the server sends
      const leaf = await new Promise<X509Certificate>((resolve, reject) => {
        const socket = tls.connect(
          { host: hostname, port: 443, rejectUnauthorized: false, servername: hostname, timeout: 10_000 },
          () => {
            const peer = socket.getPeerCertificate(true);
            socket.end();
            if (!peer?.raw) return reject(new Error('No peer certificate'));
            resolve(new X509Certificate(peer.raw));
          },
        );
        socket.on('error', reject);
        socket.on('timeout', () => { socket.destroy(); reject(new Error('timeout')); });
      });

      // 2. Walk up the chain via AIA until we hit a trusted root
      const result: string[] = [];
      const seen = new Set<string>();
      let current = leaf;

      for (let i = 0; i < 10; i++) {
        if (rootSubjects.has(current.issuer)) break;
        if (current.subject === current.issuer) break;
        if (seen.has(current.fingerprint256)) break;
        seen.add(current.fingerprint256);

        const url = current.infoAccess?.match(/CA Issuers - URI:(\S+)/)?.[1];
        if (!url) break;

        const res = await request(url, { dispatcher: aiaDispatcher, headersTimeout: 10_000, bodyTimeout: 10_000 });
        if (res.statusCode < 200 || res.statusCode >= 300) break;

        const der = Buffer.from(await res.body.arrayBuffer());
        const pem = '-----BEGIN CERTIFICATE-----\n' +
          der.toString('base64').match(/.{1,64}/g)!.join('\n') +
          '\n-----END CERTIFICATE-----\n';

        result.push(pem);
        current = new X509Certificate(der);
      }

      return result;
    } catch {
      return [];
    }
  });

  if (extras && extras.length === 0) {
    await cache.set(key, extras, '5m');
  }
  return extras ?? [];
}

export function isChainError(err: unknown): boolean {
  const code = (err as any)?.code ?? (err as any)?.cause?.code;
  return code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN';
}
