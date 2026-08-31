#import "AppDelegate.h"
#import "AnalyticsBridge.h"

#import <FirebaseCore/FirebaseCore.h>
#import <React/RCTBridge.h>
#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>

static NSURL *RadioTeduURLForUserActivity(NSUserActivity *activity)
{
  if ([activity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb]) {
    return activity.webpageURL;
  }
  if (![activity.activityType isEqualToString:@"com.radiotedumobile.playback"]) {
    return nil;
  }
  NSString *mediaID = [activity.userInfo[@"media_id"] isKindOfClass:NSString.class]
      ? activity.userInfo[@"media_id"]
      : @"";
  NSString *route = [mediaID hasPrefix:@"podcast"]
      ? @"radiotedu://podcasts"
      : [NSString stringWithFormat:@"radiotedu://play/%@",
            [mediaID stringByAddingPercentEncodingWithAllowedCharacters:NSCharacterSet.URLPathAllowedCharacterSet]];
  return [NSURL URLWithString:route];
}

@interface RadioTEDUSceneDelegate : UIResponder <UIWindowSceneDelegate>
@property (strong, nonatomic) UIWindow *window;
- (void)forwardURLToReactNative:(NSURL *)URL;
@end

@implementation RadioTEDUSceneDelegate

- (void)forwardURLToReactNative:(NSURL *)URL
{
  if (URL == nil) {
    return;
  }
  AppDelegate *appDelegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
  RCTBridge *bridge = appDelegate.bridge;
  if (bridge != nil && bridge.loading) {
    // RCTLinkingManager notifications are not replayed. On a scene-based cold
    // launch, wait until the JS bundle has installed AuthContext's URL listener.
    __block id observer = nil;
    observer = [[NSNotificationCenter defaultCenter]
        addObserverForName:RCTJavaScriptDidLoadNotification
                    object:nil
                     queue:NSOperationQueue.mainQueue
                usingBlock:^(__unused NSNotification *notification) {
                  [RCTLinkingManager application:UIApplication.sharedApplication
                                         openURL:URL
                                         options:@{}];
                  [[NSNotificationCenter defaultCenter] removeObserver:observer];
                }];
    return;
  }
  [RCTLinkingManager application:UIApplication.sharedApplication
                         openURL:URL
                         options:@{}];
}

- (void)scene:(UIScene *)scene
    willConnectToSession:(UISceneSession *)session
    options:(UISceneConnectionOptions *)connectionOptions
{
  if (![scene isKindOfClass:UIWindowScene.class]) {
    return;
  }

  AppDelegate *appDelegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
  UIViewController *rootViewController = appDelegate.window.rootViewController;
  self.window = [[UIWindow alloc] initWithWindowScene:(UIWindowScene *)scene];
  self.window.rootViewController = rootViewController;
  appDelegate.window = self.window;
  [self.window makeKeyAndVisible];

  // Scene-based launches bypass the classic AppDelegate URL callback. Forward
  // the initial ERP/custom-scheme URL after React Native owns the window.
  for (UIOpenURLContext *urlContext in connectionOptions.URLContexts) {
    [self forwardURLToReactNative:urlContext.URL];
  }
  for (NSUserActivity *userActivity in connectionOptions.userActivities) {
    [self forwardURLToReactNative:RadioTeduURLForUserActivity(userActivity)];
  }
}

- (void)scene:(UIScene *)scene openURLContexts:(NSSet<UIOpenURLContext *> *)URLContexts
{
  for (UIOpenURLContext *urlContext in URLContexts) {
    [self forwardURLToReactNative:urlContext.URL];
  }
}

- (void)scene:(UIScene *)scene continueUserActivity:(NSUserActivity *)userActivity
{
  [self forwardURLToReactNative:RadioTeduURLForUserActivity(userActivity)];
}

@end

@implementation AppDelegate

- (void)consumePendingAppIntent
{
  NSUserDefaults *defaults = NSUserDefaults.standardUserDefaults;
  NSString *pendingURL = [defaults stringForKey:@"radiotedu.pending_app_intent_url"];
  if (pendingURL.length == 0) {
    return;
  }
  [defaults removeObjectForKey:@"radiotedu.pending_app_intent_url"];
  NSURL *URL = [NSURL URLWithString:pendingURL];
  if (URL == nil) {
    return;
  }
  if (self.bridge != nil && self.bridge.loading) {
    __block id observer = nil;
    observer = [[NSNotificationCenter defaultCenter]
        addObserverForName:RCTJavaScriptDidLoadNotification
                    object:nil
                     queue:NSOperationQueue.mainQueue
                usingBlock:^(__unused NSNotification *notification) {
                  [RCTLinkingManager application:UIApplication.sharedApplication
                                         openURL:URL
                                         options:@{}];
                  [[NSNotificationCenter defaultCenter] removeObserver:observer];
                }];
    return;
  }
  [RCTLinkingManager application:UIApplication.sharedApplication openURL:URL options:@{}];
}

- (void)radioTeduDidBecomeActive:(__unused NSNotification *)notification
{
  [self consumePendingAppIntent];
}

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"RadioTEDUMobile";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  // Firebase Analytics requires the administrator-generated iOS app config.
  // If it is absent in a developer checkout, analytics remains a safe no-op.
  NSString *firebaseConfig =
      [[NSBundle mainBundle] pathForResource:@"GoogleService-Info" ofType:@"plist"];
  if (firebaseConfig != nil) {
    [FIRApp configure];
    [AnalyticsBridge revokeStaleConsent];
  }

  BOOL launched = [super application:application didFinishLaunchingWithOptions:launchOptions];
  [[NSNotificationCenter defaultCenter]
      addObserver:self
         selector:@selector(radioTeduDidBecomeActive:)
             name:UIApplicationDidBecomeActiveNotification
           object:nil];
  dispatch_async(dispatch_get_main_queue(), ^{
    [self consumePendingAppIntent];
  });
  return launched;
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options
{
  return [RCTLinkingManager application:application openURL:url options:options];
}

- (BOOL)application:(UIApplication *)application
continueUserActivity:(NSUserActivity *)userActivity
  restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> *restorableObjects))restorationHandler
{
  NSURL *URL = RadioTeduURLForUserActivity(userActivity);
  if (URL != nil) {
    return [RCTLinkingManager application:application openURL:URL options:@{}];
  }
  return [RCTLinkingManager application:application
                    continueUserActivity:userActivity
                      restorationHandler:restorationHandler];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self getBundleURL];
}

- (NSURL *)getBundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
