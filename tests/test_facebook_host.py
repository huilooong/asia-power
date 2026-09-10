"""Facebook www host guard and Google-checkpoint detection."""

from __future__ import annotations

import unittest

from integrations.social_browser.facebook_host import (
    facebook_www_url,
    is_facebook_host,
    is_google_identity_checkpoint,
    rewrite_google_facebook_redirect,
)
from customer_gateway.meta_page_token import pick_page


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


    def test_rewrites_google_oauth_redirect_uri(self) -> None:
        src = (
            "https://accounts.google.com/o/oauth2/v2/auth"
            "?client_id=abc"
            "&redirect_uri=https%3A%2F%2Fweb.facebook.com%2Fauth_platform%2Fcallback"
        )
        out = rewrite_google_facebook_redirect(src)
        self.assertIn("www.facebook.com", out)
        self.assertNotIn("web.facebook.com", out)

    def test_leaves_facebook_web_page_alone(self) -> None:
        src = "https://web.facebook.com/auth_platform/login_with_third_party/?apc=1"
        self.assertEqual(rewrite_google_facebook_redirect(src), src)
        src = "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https://web.facebook.com/oauth2/redirect/"
        out = rewrite_google_facebook_redirect(src)
        self.assertIn("redirect_uri=https://www.facebook.com/oauth2/redirect/", out)
        self.assertNotIn("web.facebook.com", out)
        src = "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https://web.facebook.com/x"
        out = rewrite_google_facebook_redirect(src)
        self.assertIn("https://www.facebook.com/x", out)


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


if __name__ == "__main__":
    unittest.main()
