#import <AVKit/AVKit.h>
#import <React/RCTViewManager.h>

@interface RadioTeduAirPlayRoutePickerManager : RCTViewManager
@end

@implementation RadioTeduAirPlayRoutePickerManager

RCT_EXPORT_MODULE(RadioTeduAirPlayRoutePicker)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (UIView *)view
{
  AVRoutePickerView *picker = [[AVRoutePickerView alloc] initWithFrame:CGRectZero];
  picker.prioritizesVideoDevices = NO;
  picker.tintColor = UIColor.whiteColor;
  picker.activeTintColor = [UIColor colorWithRed:0.89 green:0.12 blue:0.14 alpha:1.0];
  return picker;
}

@end
