# AsiaPower Android Packaging Preparation

## Scope

APAPP-001 only prepares the website as an installable PWA and documents the future Android path. It does not generate an APK, change business logic, or modify WhatsApp, Supplier Portal, Sales Brain, Telegram, or Sales Intelligence code.

## Android Studio

Use Android Studio to create a small native wrapper project when the CEO approves Phase 2. The wrapper should load `https://asia-power.com/` in a WebView and keep all business logic on the web application.

Recommended package name:

```text
com.asiapower.app
```

## WebView

Baseline WebView settings:

- Enable JavaScript for the existing website UI.
- Keep DOM storage enabled for normal browser-like behavior.
- Open external schemes such as `https://wa.me/` outside the WebView so WhatsApp enquiry flow is not changed.
- Do not inject scripts into the website.
- Do not intercept form submissions.
- Keep file upload behavior compatible with Supplier Portal before enabling supplier upload screens inside the wrapper.

## APK

Build APK/AAB only after:

- PWA checks pass on production.
- Quote forms and WhatsApp links are verified on Android Chrome.
- Supplier Portal is verified or explicitly excluded from the first wrapper release.
- CEO approves store branding, privacy copy, and support contact.

## Google Play

Before Google Play submission, prepare:

- App name: `AsiaPower`
- Short description focused on powertrain sourcing.
- Screenshots from production mobile pages.
- Privacy policy URL.
- Data safety answers.
- Support email and company contact details.

## Update Strategy

The PWA and future WebView wrapper should use web-first updates:

- Website deploys update content and UI.
- Service worker cache version changes only when static shell assets change.
- Android wrapper updates are reserved for native capabilities, policy changes, deep links, push notifications, or WebView compatibility work.

## Push Notification Reserve

Do not enable push notifications in APAPP-001. Reserve native push for:

- CEO-approved quote status notifications.
- Buyer opt-in updates.
- Supplier upload review status.

Any push rollout must include consent, unsubscribe, and quiet-hours policy.

## Deep Link Reserve

Reserve deep links for:

- `/pages/quote.html`
- `/truck-heads/`
- `/engines/`
- `/half-cuts/`

Future Android intent filters should map approved app links to `https://asia-power.com/` URLs without changing canonical SEO URLs.
