"""Facebook www host guard and Google-checkpoint detection."""

from __future__ import annotations

import unittest

from integrations.social_browser.facebook_host import (
    facebook_www_url,
    is_facebook_host,
    is_google_identity_checkpoint,
)
from unittest.mock import patch

from customer_gateway.meta_page_token import pick_page
from customer_gateway.social_autopilot import _publish_one


class FacebookHostTests(unittest.TestCase):
    def test_rewrites_web_to_www(self) -> None:
        src = "https://web.facebook.com/auth_platform/login_with_third_party/?apc=1"
        out = facebook_www_url(src)
        self.assertTrue(out.startswith("https://www.facebook.com/auth_platform/"))
        self.assertIn("apc=1", out)

    def test_rewrites_bare_host(self) -> None:
        self.assertEqual(facebook_www_url("https://facebook.com/"), "https://www.facebook.com/")

    def test_leaves_www_and_mobile(self) -> None:
        www = "https://www.facebook.com/login"
        self.assertEqual(facebook_www_url(www), www)
        mobile = "https://m.facebook.com/login"
        self.assertEqual(facebook_www_url(mobile), mobile)

    def test_checkpoint_detection(self) -> None:
        url = "https://web.facebook.com/auth_platform/login_with_third_party/?apc=x"
        self.assertTrue(is_google_identity_checkpoint(url))
        self.assertFalse(is_google_identity_checkpoint("https://www.facebook.com/"))

    def test_facebook_host(self) -> None:
        self.assertTrue(is_facebook_host("web.facebook.com"))
        self.assertFalse(is_facebook_host("accounts.google.com"))


class PickPageTests(unittest.TestCase):
    def test_prefers_page_id(self) -> None:
        rows = [
            {"id": "1", "name": "Other", "access_token": "a"},
            {"id": "61591139770494", "name": "AsiaPower", "access_token": "b"},
        ]
        picked = pick_page(rows, page_id="61591139770494")
        self.assertEqual(picked["access_token"], "b")

    def test_prefers_name(self) -> None:
        rows = [
            {"id": "9", "name": "AsiaPower", "access_token": "z"},
            {"id": "8", "name": "Else", "access_token": "y"},
        ]
        picked = pick_page(rows, page_id="")
        self.assertEqual(picked["id"], "9")


class AutopilotFacebookTests(unittest.TestCase):
    def test_facebook_without_api_refuses_browser(self) -> None:
        with patch("customer_gateway.social_autopilot._platform_ready", return_value=True), patch(
            "customer_gateway.social_autopilot.api_ready", return_value=False
        ), patch(
            "customer_gateway.social_post_assets.resolve_post_assets",
            return_value={"caption": "hi", "listing_url": "", "image_urls": []},
        ):
            out = _publish_one({"platform": "facebook", "post_id": "t1"})
        self.assertEqual(out.get("error"), "facebook_requires_graph_api")


if __name__ == "__main__":
    unittest.main()
