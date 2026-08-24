# Analytics collection

RadioTEDU Mobile uses Google Analytics for Firebase on Android. Collection is disabled by default and starts only after an eligible adult explicitly enables optional analytics on the first-launch privacy screen.

## First-launch answers

- Age range is stored locally as the eligibility marker.
- If the user also enables optional demographics, `age_range` and `gender` are sent to Firebase as consented user properties.
- If demographics is off, those answers are not sent to Firebase.
- If analytics is declined, collection stays disabled and Firebase analytics data is reset.
- Advertising storage, ad user data, and ad personalization remain denied.

## Where results appear

- Firebase Console → Analytics → Events: automatic lifecycle events, `radiotedu_screen_view`, and `listen`.
- Firebase/GA4 custom definitions: register `age_range` and `gender` as user-scoped custom dimensions before using them in reports.
- The app does not send these answers to a RadioTEDU API or database. Raw/exportable analytics require linking the Firebase project to GA4/BigQuery using the organization’s Firebase account.

## Current platform coverage

Android is implemented. iOS analytics collection is not yet wired to the native bridge.
