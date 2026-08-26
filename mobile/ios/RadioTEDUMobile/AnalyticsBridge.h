#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

@interface AnalyticsBridge : NSObject <RCTBridgeModule>

+ (void)revokeStaleConsent;

@end
