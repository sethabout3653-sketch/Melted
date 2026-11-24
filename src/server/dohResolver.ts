import dns from 'dns';
import https from 'https';
import net from 'net';

// Known SafeSearch / Restricted / Parental Filter VIP IPs returned by restrictive WiFi DNS servers
const BLOCKED_SAFESEARCH_IPS = new Set([
  '216.239.38.120', // forcesafesearch.google.com
  '216.239.38.119', // restrict.youtube.com / restrictmoderate.youtube.com
  '204.79.197.220', // strict.bing.com
  '52.142.124.215', // strict.bing.com alternate
  '146.112.61.104', // OpenDNS block
  '146.112.61.106', // OpenDNS block
  '146.112.61.107', // OpenDNS block
  '146.112.61.108', // OpenDNS block
  '2001:4860:4802:32::78', // forcesafesearch.google.com IPv6
  '2001:4860:4802:32::77', // restrict.youtube.com IPv6
]);

interface CachedDnsEntry {
  ips: string[];
  family: 4 | 6;
  expiresAt: number;
}

const dohCache = new Map<string, CachedDnsEntry>();
const inFlightLookups = new Map<string, Promise<string[]>>();

const DOH_ENDPOINTS = [
  { host: '1.1.1.1', path: '/dns-query', servername: 'cloudflare-dns.com' },
  { host: '8.8.8.8', path: '/resolve', servername: 'dns.google' },
  { host: '1.0.0.1', path: '/dns-query', servername: 'cloudflare-dns.com' },
];

function queryDohEndpoint(
  endpoint: { host: string; path: string; servername: string },
  hostname: string,
  rrType: 'A' | 'AAAA',
  timeoutMs = 2200
): Promise<string[]> {
  return new Promise((resolve) => {
    const queryPath = `${endpoint.path}?name=${encodeURIComponent(hostname)}&type=${rrType}`;
    const req = https.request(
      {
        host: endpoint.host,
        port: 443,
        path: queryPath,
        method: 'GET',
        servername: endpoint.servername,
        headers: {
          Accept: 'application/dns-json',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          resolve([]);
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const answers = Array.isArray(parsed?.Answer) ? parsed.Answer : [];
            const wantedType = rrType === 'A' ? 1 : 28;
            const ips: string[] = [];
            for (const ans of answers) {
              if (ans?.type === wantedType && typeof ans?.data === 'string') {
                const ip = ans.data.trim();
                if (net.isIP(ip) && !BLOCKED_SAFESEARCH_IPS.has(ip.toLowerCase())) {
                  ips.push(ip);
                }
              }
            }
            resolve(ips);
          } catch {
            resolve([]);
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve([]);
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

async function resolveViaDoh(hostname: string, family: 4 | 6 = 4): Promise<string[]> {
  const cleanHost = hostname.trim().toLowerCase();
  if (!cleanHost || net.isIP(cleanHost)) {
    return cleanHost ? [cleanHost] : [];
  }
  if (cleanHost === 'localhost' || cleanHost.endsWith('.local')) {
    return [];
  }

  const cacheKey = `${cleanHost}:${family}`;
  const cached = dohCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() && cached.ips.length > 0) {
    return cached.ips;
  }

  const existingPromise = inFlightLookups.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  const rrType = family === 6 ? 'AAAA' : 'A';
  const lookupPromise = (async () => {
    for (const endpoint of DOH_ENDPOINTS) {
      const ips = await queryDohEndpoint(endpoint, cleanHost, rrType);
      if (ips.length > 0) {
        dohCache.set(cacheKey, {
          ips,
          family,
          expiresAt: Date.now() + 5 * 60 * 1000,
        });
        if (dohCache.size > 2000) {
          const oldestKey = dohCache.keys().next().value;
          if (oldestKey) dohCache.delete(oldestKey);
        }
        return ips;
      }
    }
    return [];
  })().finally(() => {
    inFlightLookups.delete(cacheKey);
  });

  inFlightLookups.set(cacheKey, lookupPromise);
  return lookupPromise;
}

export async function resolveUnfilteredIp(hostname: string, preferredFamily: 4 | 6 = 4): Promise<string | null> {
  if (!hostname) return null;
  if (net.isIP(hostname)) return hostname;
  const ips = await resolveViaDoh(hostname, preferredFamily);
  if (ips.length > 0) {
    return ips[0];
  }
  return null;
}

export function unfilteredLookup(
  hostname: string,
  options: any,
  callback?: (err: NodeJS.ErrnoException | null, address: any, family?: number) => void
): void {
  const cb = typeof options === 'function' ? options : callback;
  const opts = typeof options === 'object' && options !== null ? options : {};
  if (!cb) return;

  if (net.isIP(hostname)) {
    const fam = net.isIPv6(hostname) ? 6 : 4;
    if (opts.all) {
      cb(null, [{ address: hostname, family: fam }]);
    } else {
      cb(null, hostname, fam);
    }
    return;
  }

  const reqFamily: 4 | 6 = opts.family === 6 ? 6 : 4;

  resolveViaDoh(hostname, reqFamily)
    .then((ips) => {
      if (ips.length > 0) {
        if (opts.all) {
          cb(
            null,
            ips.map((ip) => ({ address: ip, family: net.isIPv6(ip) ? 6 : 4 }))
          );
        } else {
          const ip = ips[0];
          cb(null, ip, net.isIPv6(ip) ? 6 : 4);
        }
        return;
      }

      // Fallback to OS DNS if DoH is unreachable, still filtering out known SafeSearch VIPs
      dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
        if (err || !Array.isArray(addresses) || addresses.length === 0) {
          dns.lookup(hostname, opts, cb as any);
          return;
        }
        const safeAddresses = addresses.filter(
          (entry) => !BLOCKED_SAFESEARCH_IPS.has(String(entry.address || '').toLowerCase())
        );
        const finalList = safeAddresses.length > 0 ? safeAddresses : addresses;
        if (opts.all) {
          cb(null, finalList);
        } else {
          cb(null, finalList[0].address, finalList[0].family);
        }
      });
    })
    .catch(() => {
      dns.lookup(hostname, opts, cb as any);
    });
}
