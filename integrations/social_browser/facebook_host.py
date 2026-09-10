"""Keep Facebook browser sessions on www.facebook.com.

web.facebook.com Google identity checks (login_with_third_party) send a
redirect_uri Google rejects (error 400 redirect_uri_mismatch). Agents must
not treat that checkpoint as a completable login — use Meta Graph API tokens.
"""

from __future__ import annotations

from urllib.parse import urlparse, urlunparse

WWW_HOST = "www.facebook.com"
WEB_HOST = "web.facebook.com"

_FACEBOOK_HOSTS = {
    "facebook.com",
    "www.facebook.com",
    "web.facebook.com",
    "m.facebook.com",
}


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


def is_google_identity_checkpoint(url: str) -> bool:
    """True when Facebook is forcing Gmail 'use Google to verify it's you'."""
    u = (url or "").lower()
    return "login_with_third_party" in u or "/auth_platform/" in u


def attach_www_facebook_guard(context) -> None:
    """Playwright: rewrite web.facebook.com requests to www.facebook.com."""

    def _on_route(route) -> None:
        req_url = route.request.url
        rewritten = facebook_www_url(req_url)
        if rewritten != req_url:
            route.continue_(url=rewritten)
            return
        route.continue_()

    context.route("https://web.facebook.com/**", _on_route)
    context.route("http://web.facebook.com/**", _on_route)
    context.route("https://facebook.com/**", _on_route)
    context.route("http://facebook.com/**", _on_route)
