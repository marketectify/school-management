export function acceptsOrigin(origin, host, fetchSite, development = false) {
  if (fetchSite === 'cross-site') return false;
  if (!origin) return true;
  if (origin === 'http://' + host || origin === 'https://' + host) return true;
  return development && /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d{1,5}$/.test(origin);
}
