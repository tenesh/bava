//go:build darwin && cgo

// The macOS side of printing to PDF: a WKWebView of its own prints an HTML
// page to a file. Called from print_darwin.go.

#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#include <stdint.h>
#include <stdlib.h>

#include "_cgo_export.h"

// One print: a WKWebView of its own in a window never shown, sized to the
// page's printable width. When the HTML has loaded it prints to the file
// through a print operation that saves rather than prints, with no panels.
@interface BavaPDFPrinter : NSObject <WKNavigationDelegate>
@property(strong) NSWindow *window;
@property(strong) WKWebView *web;
@property(strong) NSPrintInfo *info;
@property uintptr_t handle;
@property int settleMs;
@end

static NSMutableSet *bavaPrinters;

@implementation BavaPDFPrinter

- (void)finish:(BOOL)ok message:(NSString *)message {
	bavaPDFDone(self.handle, ok ? 1 : 0, (char *)[message UTF8String]);
	// Torn down once the print operation that called here has returned: it
	// may still draw from the web view on the way out.
	dispatch_async(dispatch_get_main_queue(), ^{
		self.web.navigationDelegate = nil;
		[self.window close];
		[bavaPrinters removeObject:self];
	});
}

- (void)webView:(WKWebView *)web didFinishNavigation:(WKNavigation *)navigation {
	// A moment for layout and fonts to settle before the page is printed.
	dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)self.settleMs * NSEC_PER_MSEC), dispatch_get_main_queue(), ^{
		NSPrintOperation *op = [web printOperationWithPrintInfo:self.info];
		op.showsPrintPanel = NO;
		op.showsProgressPanel = NO;
		// WebKit's print view has no size until it is given one; without it
		// the pages come out blank.
		op.view.frame = web.bounds;
		[op runOperationModalForWindow:self.window
		                      delegate:self
		                didRunSelector:@selector(printOperationDidRun:success:contextInfo:)
		                   contextInfo:NULL];
	});
}

- (void)webView:(WKWebView *)web didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
	[self finish:NO message:error.localizedDescription];
}

- (void)webView:(WKWebView *)web didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
	[self finish:NO message:error.localizedDescription];
}

- (void)printOperationDidRun:(NSPrintOperation *)op success:(BOOL)success contextInfo:(void *)info {
	[self finish:success message:success ? @"" : @"the print operation did not complete"];
}

@end

void bavaPrintPDF(uintptr_t handle, const char *html, const char *path,
                         double width, double height,
                         double top, double right, double bottom, double left,
                         int background, int settleMs) {
	if (bavaPrinters == nil) bavaPrinters = [NSMutableSet set];
	BavaPDFPrinter *printer = [BavaPDFPrinter new];
	printer.handle = handle;
	printer.settleMs = settleMs;

	NSURL *url = [NSURL fileURLWithPath:[NSString stringWithUTF8String:path]];
	NSMutableDictionary *dict = [NSMutableDictionary dictionaryWithDictionary:@{
		NSPrintJobDisposition : NSPrintSaveJob,
		NSPrintJobSavingURL : url,
	}];
	NSPrintInfo *info = [[NSPrintInfo alloc] initWithDictionary:dict];
	info.paperSize = NSMakeSize(width, height);
	info.orientation = width > height ? NSPaperOrientationLandscape : NSPaperOrientationPortrait;
	info.topMargin = top;
	info.rightMargin = right;
	info.bottomMargin = bottom;
	info.leftMargin = left;
	info.horizontalPagination = NSPrintingPaginationModeFit;
	info.verticalPagination = NSPrintingPaginationModeAutomatic;
	info.horizontallyCentered = NO;
	info.verticallyCentered = NO;
	printer.info = info;

	NSRect frame = NSMakeRect(0, 0, width - left - right, height - top - bottom);
	WKWebViewConfiguration *config = [WKWebViewConfiguration new];
	if (@available(macOS 13.3, *)) {
		config.preferences.shouldPrintBackgrounds = background != 0;
	}
	printer.web = [[WKWebView alloc] initWithFrame:frame configuration:config];
	printer.web.navigationDelegate = printer;
	printer.window = [[NSWindow alloc] initWithContentRect:frame
	                                              styleMask:NSWindowStyleMaskBorderless
	                                                backing:NSBackingStoreBuffered
	                                                  defer:NO];
	printer.window.releasedWhenClosed = NO;
	printer.window.contentView = printer.web;
	[bavaPrinters addObject:printer];
	[printer.web loadHTMLString:[NSString stringWithUTF8String:html] baseURL:nil];
}
