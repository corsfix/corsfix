import tls from "tls";
import { X509Certificate } from "crypto";
import { request, EnvHttpProxyAgent, interceptors } from "undici";
import { Cacheable } from "cacheable";
import { ssrfInterceptor } from "../ssrfInterceptor";

const cache = new Cacheable({ ttl: "24h" });

const ROOT_CERTS = tls.rootCertificates.map((p) => new X509Certificate(p));
const rootsBySubject = new Map<string, X509Certificate[]>();
for (const root of ROOT_CERTS) {
  const arr = rootsBySubject.get(root.subject) ?? [];
  arr.push(root);
  rootsBySubject.set(root.subject, arr);
}

const MAX_CERT_BYTES = 64 * 1024;

const aiaDispatcher = new EnvHttpProxyAgent().compose([
  ssrfInterceptor,
  interceptors.dns({ dualStack: false }),
]);

function isSignedByAnyRoot(cert: X509Certificate): boolean {
  const candidates = rootsBySubject.get(cert.issuer);
  if (!candidates) return false;
  return candidates.some((root) => cert.verify(root.publicKey));
}

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
            if (!peer?.raw) return reject(new Error("No peer certificate"));
            resolve(new X509Certificate(peer.raw));
          },
        );
        socket.on("error", reject);
        socket.on("timeout", () => { socket.destroy(); reject(new Error("timeout")); });
      });

      // 2. Walk up the chain via AIA, validating each step
      const fetched: string[] = [];
      const seen = new Set<string>();
      let current = leaf;

      for (let i = 0; i < 10; i++) {
        if (rootsBySubject.has(current.issuer)) break;
        if (current.subject === current.issuer) break;
        if (seen.has(current.fingerprint256)) break;
        seen.add(current.fingerprint256);

        const aia = current.infoAccess?.match(/CA Issuers - URI:(\S+)/)?.[1];
        if (!aia) break;

        let aiaUrl: URL;
        try { aiaUrl = new URL(aia); } catch { return []; }

        const res = await request(aiaUrl, {
          dispatcher: aiaDispatcher,
          headersTimeout: 10_000,
          bodyTimeout: 10_000,
        });
        if (res.statusCode < 200 || res.statusCode >= 300) {
          await res.body.dump().catch(() => {});
          return [];
        }
        const lenHeader = res.headers["content-length"];
        const lenStr = Array.isArray(lenHeader) ? lenHeader[0] : lenHeader;
        const declaredLen = lenStr ? Number(lenStr) : NaN;
        if (Number.isFinite(declaredLen) && declaredLen > MAX_CERT_BYTES) {
          await res.body.dump().catch(() => {});
          return [];
        }

        const der = Buffer.from(await res.body.arrayBuffer());
        if (der.length > MAX_CERT_BYTES) return [];

        let next: X509Certificate;
        try { next = new X509Certificate(der); } catch { return []; }

        // Cryptographically verify: the fetched cert must really issue `current`
        if (next.subject !== current.issuer) return [];
        if (!current.verify(next.publicKey)) return [];

        fetched.push(next.toString());
        current = next;
      }

      // Final: top of chain must be signed by a known root.
      // Without this, an attacker-supplied intermediate would be added as a
      // trust anchor and could verify a forged leaf.
      if (!isSignedByAnyRoot(current)) return [];

      return fetched;
    } catch {
      return [];
    }
  });

  if (extras && extras.length === 0) {
    await cache.set(key, extras, "5m");
  }
  return extras ?? [];
}

export function isChainError(err: unknown): boolean {
  const code = (err as any)?.code ?? (err as any)?.cause?.code;
  return code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN";
}
