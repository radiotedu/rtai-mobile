# RadioTEDU — Mobile Privacy and Analytics Inventory

Status: client controls implemented. This inventory is engineering documentation,
not a legal certification. Production policies, backend behavior, contracts,
retention, transfers, Play disclosures, and controller identity require review.

## Processing groups

### Essential app, account, security, and Gold processing

These features may process account/profile details and service records as
described by RadioTEDU's deployed privacy notice. They do not depend on optional
analytics consent. The controller must document purpose, lawful basis, recipients,
retention, security, and KVKK/GDPR rights handling.

### Optional Google Analytics for Firebase

Default: off. The Android manifest disables collection before consent. The app
enables Firebase Analytics only after the user turns on the separate analytics
switch. Advertising ID collection and ad-personalization signals are disabled.

When enabled, Google Analytics for Firebase may receive:

- Firebase app-instance ID;
- app lifecycle, session, and screen activity;
- RadioTEDU listening duration and channel/content identifier;
- app/device/platform/language/version information;
- approximate location derived by Google from a masked IP address;
- optional self-declared age range and gender, only with the separate switch.

The app keeps the selected age range locally as an optional-analytics eligibility
guard. Analytics and demographics require an adult range; selecting under 18 (or
restoring an under-18 choice) turns both off and clears gender. The age range is
passed to Google only when an adult separately enables demographic sharing.

The app does not attach account ID, name, email, phone, advertising ID, contacts,
GPS, or precise location to analytics. Google is a third-party recipient. The UI
links both RadioTEDU's privacy notice and Google's privacy policy.

Withdrawal immediately disables collection, clears demographic user properties,
and resets local Firebase analytics data/identity. Previously received records
remain governed by the configured Google Analytics retention and data-subject
request process; the UI does not promise instant server-side deletion.

Implementation:

- `src/privacy/ConsentContext.tsx`: versioned, default-off consent state;
- `src/screens/ConsentScreen.tsx`: separate notice, terms acceptance, analytics,
  and demographics controls;
- `src/screens/PrivacyScreen.tsx`: later withdrawal and legal links;
- `src/services/analyticsService.ts`: consent-gated native bridge;
- `android/.../analytics/AnalyticsBridgeModule.kt`: Firebase consent and events;
- `android/app/google-services.json`: non-secret Firebase app configuration.

No Measurement Protocol API secret is embedded in the client. The Firebase SDK
uses the Android app configuration supplied by Google.

## Published mobile notices

The app links the public repository copies of the mobile-specific
[`Privacy Notice`](../../docs/MOBILE_PRIVACY_NOTICE.md) and
[`Terms of Use`](../../docs/MOBILE_TERMS_OF_USE.md). These replace the incomplete
generic website pages for mobile registration and in-app legal links. Move them
to stable RadioTEDU-owned web URLs after the same text is published there.

## Release-owner requirements

- Keep the published mobile notice accurate and approve it through the
  controller's legal/privacy process before store production rollout.
- Keep the notice and optional consent separate. Keep analytics optional and
  default-off; essential service processing must not be described as consented
  analytics.
- Configure the shortest justified GA4 retention, restrict property access,
  disable Google Signals/advertising features unless separately assessed, and
  execute applicable Google data-processing/transfer terms.
- Complete Google Play Data safety from actual release behavior, including
  Firebase's automatically collected app-instance, device, activity, and coarse
  location data when analytics is enabled.
- Provide functioning account and data-rights request/deletion routes. Obtain
  qualified review of age assurance and parental/guardian handling; the local
  under-18 analytics guard is not a legal certification.
- Obtain Turkish/EU privacy counsel approval before describing the service as
  KVKK/GDPR compliant.
