"""Keep Facebook sessions on www.facebook.com and fix Google OAuth redirect_uri.

Facebook identity checks on web.facebook.com send Google
redirect_uri=https://web.facebook.com/... which Google rejects
(error 400 redirect_uri_mismatch). Rewrite web → www before Google sees it.
"""

from __future__ import annotations

from urllib.parse import unquote, urlparse, urlunparse

WWW_HOST = "www.facebook.com"
WEB_HOST = "web.facebook.com"

_FACEBOOK_HOSTS = {
    "facebook.com",
    "www.facebook.com",
    "web.facebook.com",
    "m.facebook.com",
}

# Google OAuth URLs nest facebook hosts at 1–3 encoding layers.
_WEB_TO_WWW_REPLACEMENTS = (
    ("https://web.facebook.com/oauth2/redirect/", "https://www.facebook.com/oauth2/redirect/"),
    ("https://web.facebook.com/oauth2/redirect", "https://www.facebook.com/oauth2/redirect"),
    ("https://web.facebook.com", "https://www.facebook.com"),
    ("http://web.facebook.com", "https://www.facebook.com"),
    ("https%3A%2F%2Fweb.facebook.com", "https%3A%2F%2Fwww.facebook.com"),
    ("http%3A%2F%2Fweb.facebook.com", "https%3A%2F%2Fwww.facebook.com"),
    ("https%3A%2F%2Fweb%2Efacebook%2Ecom", "https%3A%2F%2Fwww.facebook.com"),
    ("https%253A%252F%252Fweb.facebook.com", "https%253A%252F%252Fwww.facebook.com"),
    ("web.facebook.com", "www.facebook.com"),
)


def is_facebook_host(host: str) -> bool:
    h = (host or "").split(":")[0].lower()
    return h in _FACEBOOK_HOSTS or h.endswith(".facebook.com")


def facebook_www_url(url: str) -> str:
    """Rewrite web./bare facebook hosts to www. Leave m.facebook.com unchanged."""
    raw = (url or "").strip()
    if not raw:
        return raw
    parsed = urlparse(raw)
    host = (parsed.netloc or "").split(":")[0].lower()
    if host in ("web.facebook.com", "facebook.com"):
        return urlunparse(parsed._replace(netloc=WWW_HOST))
    return raw


def rewrite_google_facebook_redirect(url: str) -> str:
    """Point Google OAuth redirect_uri at www.facebook.com instead of web.facebook.com."""
    raw = (url or "").strip()
    if not raw:
        return raw
    out = raw
    if "web.facebook.com" in raw or "web.facebook.com" in unquote(raw):
        for _ in range(4):
            nxt = out
            for old, new in _WEB_TO_WWW_REPLACEMENTS:
                nxt = nxt.replace(old, new)
            if nxt == out:
                break
            out = nxt
    return facebook_www_url(out)


def is_google_identity_checkpoint(url: str) -> bool:
    """True when Facebook is forcing Gmail 'use Google to verify it's you'."""
    u = (url or "").lower()
    return "login_with_third_party" in u or "/auth_platform/" in u


_INIT_SCRIPT = """
(() => {
  try {
    if (location.hostname === 'web.facebook.com') {
      location.replace(location.href.replace('://web.facebook.com', '://www.facebook.com'));
      return;
    }
    if (location.hostname === 'accounts.google.com' && location.href.includes('web.facebook.com')) {
      location.replace(location.href.split('web.facebook.com').join('www.facebook.com'));
    }
  } catch (err) {}
})();
"""


def attach_www_facebook_guard(context) -> None:
    """Playwright: rewrite web.facebook.com and Google OAuth redirect_uri."""

    def _on_route(route) -> None:
        req_url = route.request.url
        rewritten = rewrite_google_facebook_redirect(req_url)
        rewritten = facebook_www_url(rewritten)
        if rewritten != req_url:
            route.continue_(url=rewritten)
            return
        route.continue_()

    context.add_init_script(_INIT_SCRIPT)
    for pattern in (
        "https://web.facebook.com/**",
        "http://web.facebook.com/**",
        "https://facebook.com/**",
        "http://facebook.com/**",
        "https://accounts.google.com/**",
        "http://accounts.google.com/**",
    ):
        context.route(pattern, _on_route)
