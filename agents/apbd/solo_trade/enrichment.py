"""Optional Hunter and Apollo integrations with injectable HTTP transport."""

from __future__ import annotations

import json
from typing import Any, Protocol
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class JsonTransport(Protocol):
    def request(self, method: str, url: str, *, headers: dict[str, str], payload: dict[str, Any] | None = None) -> dict[str, Any]: ...


class HttpJsonTransport:
    def request(self, method: str, url: str, *, headers: dict[str, str], payload: dict[str, Any] | None = None) -> dict[str, Any]:
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = Request(url, data=data, headers={"Accept": "application/json", **headers}, method=method.upper())
        with urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8")
        parsed = json.loads(body)
        if not isinstance(parsed, dict):
            raise ValueError("Provider returned a non-object JSON response")
        return parsed


def _require_paid_opt_in(enabled: bool, provider: str) -> None:
    if not enabled:
        raise PermissionError(f"{provider} enrichment requires explicit paid-provider opt-in")


class HunterClient:
    base_url = "https://api.hunter.io/v2"

    def __init__(self, api_key: str, *, transport: JsonTransport | None = None, paid_opt_in: bool = False) -> None:
        self.api_key = api_key.strip()
        self.transport = transport or HttpJsonTransport()
        self.paid_opt_in = paid_opt_in

    def account(self) -> dict[str, Any]:
        """Return non-identifying account quota data. Hunter documents this call as free."""
        if not self.api_key:
            raise PermissionError("HUNTER_API_KEY is required")
        result = self.transport.request(
            "GET",
            f"{self.base_url}/account",
            headers={"X-API-KEY": self.api_key},
        )
        data = result.get("data") or {}
        requests = data.get("requests") if isinstance(data, dict) else {}
        usage: dict[str, dict[str, float | int | None]] = {}
        for name, values in (requests or {}).items():
            if not isinstance(values, dict):
                continue
            usage[str(name)] = {
                "used": values.get("used"),
                "available": values.get("available"),
                "remaining": values.get("remaining"),
            }
        return {
            "provider": "hunter",
            "plan": data.get("plan_name") if isinstance(data, dict) else "",
            "usage": usage,
        }

    def domain_search(self, domain: str, *, limit: int = 10) -> dict[str, Any]:
        _require_paid_opt_in(self.paid_opt_in, "Hunter")
        if not self.api_key:
            raise PermissionError("HUNTER_API_KEY is required")
        clean_domain = domain.strip().lower().removeprefix("https://").removeprefix("http://").split("/", 1)[0]
        if not clean_domain:
            raise ValueError("A domain is required")
        query = urlencode({"domain": clean_domain, "limit": max(1, min(100, int(limit)))})
        result = self.transport.request(
            "GET",
            f"{self.base_url}/domain-search?{query}",
            headers={"X-API-KEY": self.api_key},
        )
        data = result.get("data") or {}
        emails = data.get("emails") if isinstance(data, dict) else []
        return {
            "provider": "hunter",
            "domain": clean_domain,
            "organization": data.get("organization") if isinstance(data, dict) else "",
            "contacts": [
                {
                    "type": "email",
                    "value": row.get("value"),
                    "name": " ".join(filter(None, [row.get("first_name"), row.get("last_name")])),
                    "position": row.get("position") or "",
                    "verified": str((row.get("verification") or {}).get("status") or "").casefold() == "valid",
                    "confidence": row.get("confidence"),
                    "provider": "hunter",
                    "source": f"https://{clean_domain}",
                }
                for row in (emails or [])
                if isinstance(row, dict) and row.get("value")
            ],
        }

    def email_verify(self, email: str) -> dict[str, Any]:
        _require_paid_opt_in(self.paid_opt_in, "Hunter")
        if not self.api_key:
            raise PermissionError("HUNTER_API_KEY is required")
        clean_email = str(email or "").strip().casefold()
        if not clean_email or "@" not in clean_email:
            raise ValueError("A valid email address is required")
        query = urlencode({"email": clean_email})
        result = self.transport.request(
            "GET",
            f"{self.base_url}/email-verifier?{query}",
            headers={"X-API-KEY": self.api_key},
        )
        data = result.get("data") or {}
        status = str(data.get("status") or "unknown").casefold()
        return {
            "provider": "hunter",
            "email": clean_email,
            "status": status,
            "verified": status == "valid",
            "score": data.get("score"),
            "smtp_check": data.get("smtp_check"),
            "accept_all": data.get("accept_all"),
            "block": data.get("block"),
            "sources_count": len(data.get("sources") or []),
        }


class ApolloClient:
    base_url = "https://api.apollo.io/api/v1"

    def __init__(self, api_key: str, *, transport: JsonTransport | None = None, paid_opt_in: bool = False) -> None:
        self.api_key = api_key.strip()
        self.transport = transport or HttpJsonTransport()
        self.paid_opt_in = paid_opt_in

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        _require_paid_opt_in(self.paid_opt_in, "Apollo")
        if not self.api_key:
            raise PermissionError("APOLLO_API_KEY is required")
        return self.transport.request(
            "POST",
            f"{self.base_url}/{path.lstrip('/')}",
            headers={"Content-Type": "application/json", "x-api-key": self.api_key},
            payload=payload,
        )

    def organization_search(self, keywords: list[str], *, page: int = 1, per_page: int = 10) -> dict[str, Any]:
        result = self._post(
            "mixed_companies/search",
            {
                "q_organization_keyword_tags": [str(value).strip() for value in keywords if str(value).strip()],
                "page": max(1, int(page)),
                "per_page": max(1, min(100, int(per_page))),
            },
        )
        return {"provider": "apollo", "organizations": list(result.get("organizations") or [])}

    def people_search(self, *, organization_domains: list[str], titles: list[str], page: int = 1, per_page: int = 10) -> dict[str, Any]:
        result = self._post(
            "mixed_people/api_search",
            {
                "q_organization_domains_list": organization_domains,
                "person_titles": titles,
                "page": max(1, int(page)),
                "per_page": max(1, min(100, int(per_page))),
            },
        )
        return {"provider": "apollo", "people": list(result.get("people") or [])}
