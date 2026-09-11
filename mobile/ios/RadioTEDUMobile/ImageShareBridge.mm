#import <React/RCTBridgeModule.h>
#import <React/RCTUIManager.h>
#import <React/RCTBridge.h>
#import <React/RCTUtils.h>
#import <UIKit/UIKit.h>

@interface RadioTeduImageShare : NSObject <RCTBridgeModule, UIDocumentPickerDelegate>
@property (nonatomic, weak) RCTBridge *bridge;
@property (nonatomic, copy) RCTPromiseResolveBlock saveResolve;
@end

@implementation RadioTeduImageShare
RCT_EXPORT_MODULE()
@synthesize bridge = _bridge;
+ (BOOL)requiresMainQueueSetup { return YES; }

RCT_EXPORT_METHOD(share:(nonnull NSNumber *)tag title:(NSString *)title save:(BOOL)save
                  resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [self.bridge.uiManager addUIBlock:^(RCTUIManager *manager, NSDictionary<NSNumber *, UIView *> *registry) {
    UIView *view = registry[tag];
    if (!view || view.bounds.size.width <= 0 || view.bounds.size.height <= 0) {
      reject(@"E_CAPTURE", @"Image is not ready", nil); return;
    }
    CGFloat ratio = view.bounds.size.height / view.bounds.size.width;
    CGFloat height = fabs(ratio - 1) < 0.01 ? 1080 : fabs(ratio - 16.0 / 9.0) < 0.01 ? 1920 : 0;
    if (!height) { reject(@"E_CAPTURE", @"Invalid image dimensions", nil); return; }
    UIGraphicsBeginImageContextWithOptions(CGSizeMake(1080, height), YES, 1);
    [view drawViewHierarchyInRect:CGRectMake(0, 0, 1080, height) afterScreenUpdates:YES];
    UIImage *image = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();
    NSData *png = image ? UIImagePNGRepresentation(image) : nil;
    NSURL *url = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:
      [NSString stringWithFormat:@"RadioTEDU-%@.png", NSUUID.UUID.UUIDString]]];
    NSError *error;
    if (!png || ![png writeToURL:url options:NSDataWritingAtomic error:&error]) {
      reject(@"E_CAPTURE", @"Could not create PNG", error); return;
    }
    UIViewController *presenter = RCTPresentedViewController();
    if (!presenter) { reject(@"E_CAPTURE", @"App is not foreground", nil); return; }
    if (save) {
      if (self.saveResolve) {reject(@"E_BUSY", @"A save is already open", nil); return;}
      self.saveResolve = resolve;
      UIDocumentPickerViewController *picker = [[UIDocumentPickerViewController alloc] initForExportingURLs:@[url] asCopy:YES];
      picker.delegate = self;
      [presenter presentViewController:picker animated:YES completion:nil];
      return;
    }
    UIActivityViewController *sheet = [[UIActivityViewController alloc] initWithActivityItems:@[url] applicationActivities:nil];
    sheet.popoverPresentationController.sourceView = presenter.view;
    sheet.popoverPresentationController.sourceRect = CGRectMake(CGRectGetMidX(presenter.view.bounds), CGRectGetMidY(presenter.view.bounds), 1, 1);
    sheet.completionWithItemsHandler = ^(UIActivityType type, BOOL completed, NSArray *items, NSError *shareError) {
      if (shareError) { reject(@"E_SHARE", shareError.localizedDescription, shareError); }
      else { resolve(@{ @"completed": @(completed) }); }
    };
    [presenter presentViewController:sheet animated:YES completion:nil];
  }];
}
- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller {
  if (self.saveResolve) {self.saveResolve(@NO); self.saveResolve = nil;}
}
- (void)documentPicker:(UIDocumentPickerViewController *)controller didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls {
  if (self.saveResolve) {self.saveResolve(@YES); self.saveResolve = nil;}
}
@end
