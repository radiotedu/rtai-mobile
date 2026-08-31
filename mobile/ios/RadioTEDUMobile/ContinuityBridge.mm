#import <React/RCTBridgeModule.h>

@interface RadioTeduContinuityBridge : NSObject <RCTBridgeModule>
@property (nonatomic, strong) NSUserActivity *playbackActivity;
@end

@implementation RadioTeduContinuityBridge

RCT_EXPORT_MODULE(RadioTeduContinuityBridge)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

RCT_EXPORT_METHOD(updateMedia:(NSString *)mediaID
                  title:(NSString *)title
                  artist:(NSString *)artist
                  playbackURL:(NSString *)playbackURL
                  positionSeconds:(nonnull NSNumber *)positionSeconds)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.playbackActivity invalidate];
    NSUserActivity *activity = [[NSUserActivity alloc]
        initWithActivityType:@"com.radiotedumobile.playback"];
    activity.title = title.length > 0 ? title : @"RadioTEDU";
    activity.userInfo = @{
      @"media_id": mediaID ?: @"",
      @"title": title ?: @"",
      @"artist": artist ?: @"",
      @"playback_url": playbackURL ?: @"",
      @"position_seconds": positionSeconds ?: @0,
    };
    activity.eligibleForHandoff = YES;
    activity.eligibleForSearch = NO;
    activity.eligibleForPublicIndexing = NO;
    activity.requiredUserInfoKeys = [NSSet setWithObjects:@"media_id", @"playback_url", nil];
    [activity becomeCurrent];
    self.playbackActivity = activity;
  });
}

RCT_EXPORT_METHOD(clear)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.playbackActivity invalidate];
    self.playbackActivity = nil;
  });
}

@end
