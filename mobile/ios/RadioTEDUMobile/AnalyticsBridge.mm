#import "AnalyticsBridge.h"

#import <FirebaseAnalytics/FirebaseAnalytics.h>
#import <FirebaseAnalytics/FIRAnalytics+Consent.h>
#import <FirebaseCore/FirebaseCore.h>

static NSInteger const RadioTEDUAnalyticsConsentVersion = 6;
static NSString *const RadioTEDUAnalyticsConsentVersionKey =
    @"radiotedu_analytics_consent_version";

@implementation AnalyticsBridge

RCT_EXPORT_MODULE(RadioTeduAnalyticsBridge)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

+ (BOOL)isConfigured
{
  return [FIRApp defaultApp] != nil;
}

+ (NSDictionary<FIRConsentType, FIRConsentStatus> *)consentWithAnalyticsEnabled:
    (BOOL)enabled
{
  FIRConsentStatus analyticsStatus =
      enabled ? FIRConsentStatusGranted : FIRConsentStatusDenied;
  return @{
    FIRConsentTypeAnalyticsStorage : analyticsStatus,
    FIRConsentTypeAdStorage : FIRConsentStatusDenied,
    FIRConsentTypeAdUserData : FIRConsentStatusDenied,
    FIRConsentTypeAdPersonalization : FIRConsentStatusDenied,
  };
}

+ (void)revokeStaleConsent
{
  if (![self isConfigured]) {
    return;
  }
  NSInteger storedVersion =
      [[NSUserDefaults standardUserDefaults]
          integerForKey:RadioTEDUAnalyticsConsentVersionKey];
  if (storedVersion == RadioTEDUAnalyticsConsentVersion) {
    return;
  }
  [FIRAnalytics setConsent:[self consentWithAnalyticsEnabled:NO]];
  [FIRAnalytics setAnalyticsCollectionEnabled:NO];
  [FIRAnalytics resetAnalyticsData];
}

RCT_EXPORT_METHOD(setCollectionEnabled:(BOOL)enabled
                  consentVersion:(NSInteger)consentVersion)
{
  NSInteger acceptedVersion =
      consentVersion == RadioTEDUAnalyticsConsentVersion ? consentVersion : 0;
  [[NSUserDefaults standardUserDefaults]
      setInteger:acceptedVersion
         forKey:RadioTEDUAnalyticsConsentVersionKey];
  if (![[self class] isConfigured]) {
    return;
  }
  BOOL versionedEnabled = enabled && acceptedVersion == RadioTEDUAnalyticsConsentVersion;
  [FIRAnalytics setConsent:[[self class]
                               consentWithAnalyticsEnabled:versionedEnabled]];
  [FIRAnalytics setAnalyticsCollectionEnabled:versionedEnabled];
  if (!versionedEnabled) {
    [FIRAnalytics resetAnalyticsData];
  }
}

RCT_EXPORT_METHOD(setDemographics:(NSString *_Nullable)ageRange
                  gender:(NSString *_Nullable)gender)
{
  if (![[self class] isConfigured]) {
    return;
  }
  [FIRAnalytics setUserPropertyString:ageRange forName:@"age_range"];
  [FIRAnalytics setUserPropertyString:gender forName:@"gender"];
}

RCT_EXPORT_METHOD(setListeningContext:(NSString *_Nullable)context)
{
  if (![[self class] isConfigured]) {
    return;
  }
  [FIRAnalytics setUserPropertyString:context forName:@"listening_context"];
}

RCT_EXPORT_METHOD(logEvent:(NSString *)name
                  params:(NSDictionary<NSString *, id> *)params)
{
  if (![[self class] isConfigured]) {
    return;
  }
  [FIRAnalytics logEventWithName:name parameters:params];
}

@end
