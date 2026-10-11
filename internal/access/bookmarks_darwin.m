//go:build darwin && cgo

// Security-scoped bookmarks: made when the user grants a folder or file, and
// resolved at the next launch, starting access that lasts until Bava quits.

#import <Foundation/Foundation.h>
#include <stdlib.h>
#include <string.h>

static char *bavaCopy(NSString *text) {
	return strdup(text ? [text UTF8String] : "");
}

void *bavaBookmark(const char *path, int *length, char **failure) {
	NSURL *url = [NSURL fileURLWithPath:[NSString stringWithUTF8String:path]];
	NSError *error = nil;
	NSData *data = [url bookmarkDataWithOptions:NSURLBookmarkCreationWithSecurityScope
	             includingResourceValuesForKeys:nil
	                              relativeToURL:nil
	                                      error:&error];
	if (data == nil) {
		*failure = bavaCopy(error.localizedDescription);
		return NULL;
	}
	void *out = malloc(data.length);
	memcpy(out, data.bytes, data.length);
	*length = (int)data.length;
	return out;
}

char *bavaResolve(const void *bytes, int length, int *stale, char **failure) {
	NSData *data = [NSData dataWithBytes:bytes length:length];
	BOOL isStale = NO;
	NSError *error = nil;
	NSURL *url = [NSURL URLByResolvingBookmarkData:data
	                                       options:NSURLBookmarkResolutionWithSecurityScope
	                                 relativeToURL:nil
	                           bookmarkDataIsStale:&isStale
	                                         error:&error];
	if (url == nil) {
		*failure = bavaCopy(error.localizedDescription);
		return NULL;
	}
	[url startAccessingSecurityScopedResource];
	*stale = isStale ? 1 : 0;
	return bavaCopy(url.path);
}
