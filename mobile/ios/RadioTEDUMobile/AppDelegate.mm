#import "AppDelegate.h"
#import "AnalyticsBridge.h"

#import <FirebaseCore/FirebaseCore.h>
#import <React/RCTBridge.h>
#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>

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
    if ([userActivity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb]) {
      [self forwardURLToReactNative:userActivity.webpageURL];
    }
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
  [RCTLinkingManager application:UIApplication.sharedApplication
            continueUserActivity:userActivity
              restorationHandler:^(NSArray<id<UIUserActivityRestoring>> *restorableObjects) {}];
}

@end

@implementation AppDelegate

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

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
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
