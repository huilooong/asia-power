'use strict';

/** Exclude known scanner targets, without discarding real search or campaign URLs. */
function isProbeRequest(pagePath) {
  let url;
  try {
    url = new URL(String(pagePath || ''), 'https://asia-power.com');
  } catch {
    return true;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname).toLowerCase();
  } catch {
    return true;
  }
  if (/(?:^|\/)(?:wp-admin|wp-includes|wp-content|wp-json|\.git|\.svn)(?:\/|$)/.test(pathname)) return true;
  if (/(?:^|\/)(?:wp-login\.php|xmlrpc\.php|\.env(?:\.[^/]*)?)(?:\/|$)/.test(pathname)) return true;
  for (const [key, value] of url.searchParams) {
    if (/^(?:file|path|template)$/i.test(key) && /(?:^|[\\/])\.\.[\\/]/.test(value)) return true;
  }
  // This site does not run WordPress. Scanners also probe its REST API via '/'.
  return [...url.searchParams.keys()].some((key) => key.toLowerCase() === 'rest_route');
}

module.exports = { isProbeRequest };
