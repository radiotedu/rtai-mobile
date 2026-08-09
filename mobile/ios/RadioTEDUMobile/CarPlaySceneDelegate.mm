#import "CarPlaySceneDelegate.h"

#import "AppDelegate.h"
#import <React/RCTBridge.h>

@implementation CarPlaySceneDelegate {
  CPInterfaceController *_interfaceController;
}

- (NSArray<NSDictionary<NSString *, NSString *> *> *)radioChannels
{
  return @[
    @{ @"id": @"radiotedu-main", @"title": @"RadioTEDU" },
    @{ @"id": @"radiotedu-classic", @"title": @"Classic" },
    @{ @"id": @"radiotedu-jazz", @"title": @"Jazz" },
    @{ @"id": @"radiotedu-lofi", @"title": @"Lo-Fi" },
    @{ @"id": @"radiotedu-spark", @"title": @"rtAI" },
    @{ @"id": @"radiotedu-rock", @"title": @"Rock" },
  ];
}

- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
      didConnectInterfaceController:(CPInterfaceController *)interfaceController
{
  _interfaceController = interfaceController;
  NSMutableArray<CPListItem *> *items = [NSMutableArray array];
  __weak CarPlaySceneDelegate *weakSelf = self;

  for (NSDictionary<NSString *, NSString *> *channel in [self radioChannels]) {
    CPListItem *item = [[CPListItem alloc] initWithText:channel[@"title"] detailText:@"Live radio"];
    NSString *channelId = channel[@"id"];
    item.handler = ^(id<CPSelectableListItem> selectedItem, dispatch_block_t completionBlock) {
      [weakSelf playChannelWithId:channelId];
      completionBlock();
    };
    [items addObject:item];
  }

  CPListSection *section = [[CPListSection alloc] initWithItems:items header:@"Live Radio" sectionIndexTitle:nil];
  CPListTemplate *rootTemplate = [[CPListTemplate alloc] initWithTitle:@"RadioTEDU" sections:@[ section ]];
  [interfaceController setRootTemplate:rootTemplate animated:NO completion:nil];
}

- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
   didDisconnectInterfaceController:(CPInterfaceController *)interfaceController
{
  _interfaceController = nil;
}

- (void)playChannelWithId:(NSString *)channelId
{
  AppDelegate *appDelegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
  [appDelegate.bridge enqueueJSCall:@"RCTDeviceEventEmitter"
                             method:@"emit"
                               args:@[ @"remote-play-id", @{ @"id": channelId } ]
                         completion:NULL];
  [_interfaceController pushTemplate:CPNowPlayingTemplate.sharedTemplate animated:YES completion:nil];
}

@end
