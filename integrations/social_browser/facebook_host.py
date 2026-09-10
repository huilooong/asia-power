"""Fix Google OAuth redirect_uri when Facebook forces web.facebook.com.

Facebook in many regions 302s www → web. Fighting that redirect loops.
Google only accepts https://www.facebook.com/oauth2/redirect/
so we rewrite Google OAuth URLs only, and leave the Facebook tab on web.
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

_WEB_TO_WWW_REPLACEMENTS = (
    ("https://web.facebook.com/oauth2/redirect/", "https://www.facebook.com/oauth2/redirect/"),
    ("https://web.facebook.com/oauth2/redirect", "https://www.facebook.com/oauth2/redirect"),
    ("https://web.facebook.com", "https://www.facebook.com"),
    ("http://web.facebook.com", "https://www.facebook.com"),
    ("https%3A%2F%2Fweb.facebook.com%2Foauth2%2Fredirect%2F", "https%3A%2F%2Fwww.facebook.com%2Foauth2%2Fredirect%2F"),
    ("https%3A%2F%2Fweb.facebook.com", "https%3A%2F%2Fwww.facebook.com"),
    ("http%3A%2F%2Fweb.facebook.com", "https%3A%2F%2Fwww.facebook.com"),
    ("https%3A%2F%2Fweb%2Efacebook%2Ecom", "https%3A%2F%2Fwww.facebook.com"),
    ("https%253A%252F%252Fweb.facebook.com", "https%253A%252F%252Fwww.facebook.com"),
    ("web.facebook.com", "www.facebook.com"),
)


def is_facebook_host(host: str) -> bool:
    h = (host or "").split(":")[0].lower()
    return h in _FACEBOOK_HOSTS or h.endswith(".facebook.com")


def is_google_accounts_url(url: str) -> bool:
    host = urlparse(url or "").netloc.split(":")[0].lower()
    return host == "accounts.google.com"


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
    """On Google OAuth only: swap web.facebook.com → www.facebook.com in redirect_uri.

    Do not rewrite Facebook page URLs — www always 302s back to web for this account.
    """
    raw = (url or "").strip()
    if not raw or not is_google_accounts_url(raw):
        return raw
    out = raw
    if "web.facebook.com" not in raw and "web.facebook.com" not in unquote(raw):
        return raw
    for _ in range(4):
        nxt = out
        for old, new in _WEB_TO_WWW_REPLACEMENTS:
            nxt = nxt.replace(old, new)
        if nxt == out:
            break
        out = nxt
    return out


def is_google_identity_checkpoint(url: str) -> bool:
    """True when Facebook is forcing Gmail 'use Google to verify it's you'."""
    u = (url or "").lower()
    return "login_with_third_party" in u or "/auth_platform/" in u


_INIT_SCRIPT = """
(() => {
  try {
    if (location.hostname !== 'accounts.google.com') return;
    if (!location.href.includes('web.facebook.com')) return;
    location.replace(location.href.split('web.facebook.com').join('www.facebook.com'));
  } catch (err) {}
})();
"""


def attach_www_facebook_guard(context) -> None:
    """Playwright: rewrite Google OAuth redirect_uri only (do not fight www→web)."""

    def _on_route(route) -> None:
        req_url = route.request.url
        rewritten = rewrite_google_facebook_redirect(req_url)
        if rewritten != req_url:
            route.continue_(url=rewritten)
            return
        route.continue_()

    context.add_init_script(_INIT_SCRIPT)
    context.route("https://accounts.google.com/**", _on_route)
    context.route("http://accounts.google.com/**", _on_route)
