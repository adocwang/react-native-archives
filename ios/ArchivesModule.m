#import "ArchivesModule.h"
#import <CoreText/CoreText.h>
#import <React/RCTBlobManager.h>
#import <React/RCTReloadCommand.h>
#import <CommonCrypto/CommonDigest.h>
#import <MobileCoreServices/MobileCoreServices.h>

#define RCTErrorMissing @"E_MISSING"
#define RCTErrorUnspecified @"E_UNSPECIFIED"
#define RCTArchivesEvent @"ArchivesModuleEvent"

@interface DocumentPreview: UIDocumentInteractionController<UIDocumentInteractionControllerDelegate>
@property(nonatomic, strong) NSString *linkpath;
@property(nonatomic, strong) UIViewController *rootViewController;
@property(nonatomic, strong, nullable) void (^eventBlock)(NSString *event);
@end

@implementation DocumentPreview
- (instancetype)initWithOptions:(NSDictionary *)options block:(void (^_Nullable)(NSString *event))eventBlock {
    if(self = [super init]) {
        NSString *ext = options[@"ext"];
        NSString *file = options[@"file"];
        NSString *name = options[@"title"];
        if ([ext length] > 0) {
            NSError *error = nil;
            NSString *uuid =[[NSUUID UUID] UUIDString];
            _linkpath = [NSString stringWithFormat:@"%@/%@.%@", [file stringByDeletingLastPathComponent], uuid, ext];
            if (![[NSFileManager defaultManager] linkItemAtPath:file toPath:_linkpath error:&error]) {
                return self;
            }
            if ([name length] == 0) {
                name = [[file lastPathComponent] stringByDeletingPathExtension];
            }
            file = _linkpath;
        }
        if ([name length] > 0) {
            self.name = name;
        }
        self.delegate = self;
        self.URL = [NSURL fileURLWithPath:file];
        self.eventBlock = eventBlock;
        self.rootViewController = [[[[UIApplication sharedApplication] delegate] window] rootViewController];
    }
    return self;
}

- (UIViewController *)documentInteractionControllerViewControllerForPreview:(UIDocumentInteractionController *)controller {
    return self.rootViewController;
}

- (CGRect)documentInteractionControllerRectForPreview:(UIDocumentInteractionController *)controller {
    return self.rootViewController.view.frame;
}

- (nullable UIView *)documentInteractionControllerViewForPreview:(UIDocumentInteractionController *)controller {
    return self.rootViewController.view;
}

- (void)documentInteractionControllerDidEndPreview:(UIDocumentInteractionController *)controller {
    if (_linkpath) {
        [[NSFileManager defaultManager] removeItemAtPath:_linkpath error:nil];
    }
    if (_eventBlock) {
        _eventBlock(@"end");
    }
}
@end


@implementation ArchivesModule

RCT_EXPORT_MODULE()

- (NSArray<NSString *> *)supportedEvents
{
    return @[RCTArchivesEvent];
}

+ (BOOL)requiresMainQueueSetup
{
    return YES;
}

- (void)reject:(RCTPromiseRejectBlock)reject withError:(NSError *)error
{
  NSString *codeWithDomain = [NSString stringWithFormat:@"E%@%zd", error.domain.uppercaseString, error.code];
  return reject(codeWithDomain, error.localizedDescription, error);
}

- (NSString *)getPathForDirectory:(int)directory
{
  NSArray *paths = NSSearchPathForDirectoriesInDomains(directory, NSUserDomainMask, YES);
  return [paths firstObject];
}

- (NSDictionary *)constantsToExport
{
  return @{
      @"dirs": @{
              @"MainBundle": [[NSBundle mainBundle] bundlePath],
              @"Document": [self getPathForDirectory:NSDocumentDirectory],
              @"Library": [self getPathForDirectory:NSLibraryDirectory],
              @"Caches": [self getPathForDirectory:NSCachesDirectory],
              @"Temporary": NSTemporaryDirectory()
      },
      @"status": @{
              @"downloadRootDir": NSTemporaryDirectory()
      }
  };
}

RCT_EXPORT_METHOD(getMimeType:(NSArray *)names
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSMutableArray *mimeTypes = [[NSMutableArray alloc] init];
    for (NSString *name in names) {
        [mimeTypes addObject:[self getMimeType:name]];
    }
    return resolve(mimeTypes);
}

- (NSString *)getMimeType:(NSString *)filePath
{
    NSString *fileExtension = [filePath pathExtension];
    NSString *UTI = (__bridge_transfer NSString *)UTTypeCreatePreferredIdentifierForTag(kUTTagClassFilenameExtension, (__bridge CFStringRef)fileExtension, NULL);
    NSString *mimeType = (__bridge_transfer NSString *)UTTypeCopyPreferredTagWithClass((__bridge CFStringRef)UTI, kUTTagClassMIMEType);
    return mimeType ?: @"application/octet-stream";
}

// todo: options.file 兼容 scheme://
RCT_EXPORT_METHOD(getHash:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSString *file = options[@"file"];
    if ([file length] == 0) {
        return reject(RCTErrorMissing, @"missing file argument", nil);
    }
    NSString *hash = [options objectForKey:@"hash"];
    NSFileManager *manager = [NSFileManager defaultManager];
    if (![manager fileExistsAtPath:file isDirectory: false]) {
        return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"file not exist: %@", file], nil);
    }
    NSArray *keys = [NSArray arrayWithObjects:@"md5", @"sha1", @"sha224", @"sha256", @"sha384", @"sha512", nil];
    NSArray *digestLengths = [NSArray arrayWithObjects:
                              @CC_MD5_DIGEST_LENGTH, @CC_SHA1_DIGEST_LENGTH, @CC_SHA224_DIGEST_LENGTH,
                              @CC_SHA256_DIGEST_LENGTH, @CC_SHA384_DIGEST_LENGTH, @CC_SHA512_DIGEST_LENGTH, nil];
    NSDictionary *keysToDigestLengths = [NSDictionary dictionaryWithObjects:digestLengths forKeys:keys];
    int digestLength = [[keysToDigestLengths objectForKey:hash] intValue];
    if (!digestLength) {
        return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"Invalid hash algorithm: %@", hash], nil);
    }
    unsigned char buffer[digestLength];
    NSData *content = [manager contentsAtPath:file];
    if ([hash isEqualToString:@"md5"]) {
      CC_MD5(content.bytes, (CC_LONG)content.length, buffer);
    } else if ([hash isEqualToString:@"sha1"]) {
      CC_SHA1(content.bytes, (CC_LONG)content.length, buffer);
    } else if ([hash isEqualToString:@"sha224"]) {
      CC_SHA224(content.bytes, (CC_LONG)content.length, buffer);
    } else if ([hash isEqualToString:@"sha256"]) {
      CC_SHA256(content.bytes, (CC_LONG)content.length, buffer);
    } else if ([hash isEqualToString:@"sha384"]) {
      CC_SHA384(content.bytes, (CC_LONG)content.length, buffer);
    } else if ([hash isEqualToString:@"sha512"]) {
      CC_SHA512(content.bytes, (CC_LONG)content.length, buffer);
    } else {
        return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"Invalid hash algorithm: %@", hash], nil);
    }
    NSMutableString *output = [NSMutableString stringWithCapacity:digestLength * 2];
    for(int i = 0; i < digestLength; i++) {
        [output appendFormat:@"%02x",buffer[i]];
    }
    return resolve(output);
}

// todo: dirPath 兼容 scheme://
RCT_EXPORT_METHOD(isDir:(NSString *)dirPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    BOOL isDir;
    NSFileManager *manager = [NSFileManager defaultManager];
    if (![manager fileExistsAtPath:dirPath isDirectory: &isDir]) {
        return resolve([NSNull null]);
    }
    return resolve([NSNumber numberWithBool:isDir]);
}

// todo: dirPath 兼容 scheme://
RCT_EXPORT_METHOD(readDir:(NSString *)dirPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        __block NSError *error = nil;
        NSURL *fileURL = [[NSURL alloc] initFileURLWithPath:dirPath];
        NSFileManager *manager = [NSFileManager defaultManager];
        NSDirectoryEnumerator *enumerator = [manager enumeratorAtURL:fileURL
                                          includingPropertiesForKeys:@[NSURLNameKey, NSURLPathKey, NSURLIsDirectoryKey, NSURLIsPackageKey, NSURLFileSizeKey, NSURLCreationDateKey, NSURLContentModificationDateKey]
                                                             options:(NSDirectoryEnumerationSkipsSubdirectoryDescendants|NSDirectoryEnumerationSkipsPackageDescendants)
                                                        errorHandler:^BOOL(NSURL *url, NSError *err) {
            error = err;
            return NO;
        }];
        NSMutableArray *lists = [NSMutableArray array];
        for (NSURL *fileURL in enumerator) {
            NSString *name;
            [fileURL getResourceValue:&name forKey:NSURLNameKey error:nil];
            NSString *path;
            [fileURL getResourceValue:&path forKey:NSURLPathKey error:nil];
            NSNumber *isDirectory;
            [fileURL getResourceValue:&isDirectory forKey:NSURLIsDirectoryKey error:nil];
            NSNumber *size = @0;
            if (!isDirectory.boolValue) {
                [fileURL getResourceValue:&size forKey:NSURLFileSizeKey error:nil];
            }
            NSDate *ctime;
            [fileURL getResourceValue:&ctime forKey:NSURLCreationDateKey error:nil];
            NSDate *mtime;
            [fileURL getResourceValue:&mtime forKey:NSURLContentModificationDateKey error:nil];
            NSNumber *isPackage;
            [fileURL getResourceValue:&isPackage forKey:NSURLIsPackageKey error:nil];
            [lists addObject:@{
                @"name": name,
                @"path": path,
                @"size": size,
                @"isDir": isDirectory,
                @"ctime": @(round([ctime timeIntervalSince1970])),
                @"mtime": @(round([mtime timeIntervalSince1970]))
            }];
        }
        if (error) {
            return [self reject:reject withError:error];
        }
        return resolve(lists);
    } @catch (NSException *exception) {
        return reject(RCTErrorUnspecified, [exception reason], nil);
    }
}

RCT_EXPORT_METHOD(mkDir:(NSString *)dirPath
                  recursive:(BOOL *)recursive
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    BOOL isDir;
    NSFileManager *manager = [NSFileManager defaultManager];
    if ([manager fileExistsAtPath:dirPath isDirectory: &isDir]) {
        if (!isDir) {
            return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"Path already exist and is not dir: %@", dirPath], nil);
        }
        return resolve([NSNull null]);
    }
    // 非递归
    if (!recursive) {
        NSString *folderPath = [dirPath stringByDeletingLastPathComponent];
        if (![manager fileExistsAtPath:folderPath isDirectory: &isDir] || !isDir) {
            return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"Parent directory not exist: %@", dirPath], nil);
        }
    }
    NSError *error = nil;
    BOOL success = [manager createDirectoryAtPath:dirPath withIntermediateDirectories:YES attributes:nil error:&error];
    if (!success) {
      return [self reject:reject withError:error];
    }
    return resolve([NSNull null]);
}

RCT_EXPORT_METHOD(rmDir:(NSString *)dirPath
                  recursive:(BOOL *)recursive
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    BOOL isDir;
    NSFileManager *manager = [NSFileManager defaultManager];
    if (![manager fileExistsAtPath:dirPath isDirectory: &isDir]) {
        return resolve([NSNull null]);
    }
    if (!isDir) {
        return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"Path not dir: %@", dirPath], nil);
    }
    if (recursive) {
        // 递归: 使用 removeItemAtPath
        NSError *error = nil;
        BOOL success = [manager removeItemAtPath:dirPath error:&error];
        if (!success) {
          return [self reject:reject withError:error];
        }
    } else {
        // 非递归: 使用 rmdir
        const char *path = [dirPath UTF8String];
        int result = rmdir(path);
        if (result != 0) {
            return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"dir is not empty: %@", dirPath], nil);
        }
    }
    return resolve([NSNull null]);
}

RCT_EXPORT_METHOD(writeFile:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSString *origin = [options objectForKey:@"content"];
    if (origin == nil) {
        return reject(RCTErrorMissing, @"missing content argument", nil);
    }
    NSString *filepath = options[@"file"];
    if ([filepath length] == 0) {
        return reject(RCTErrorMissing, @"missing file argument", nil);
    }
    NSString *encoding = [options objectForKey:@"encoding"];
    NSNumber *position = [options objectForKey:@"position"];
    bool append = [[options objectForKey:@"append"] boolValue];
    bool create = !append && nil == position;
    
    BOOL success, exist, isDir;
    NSFileManager *manager = [NSFileManager defaultManager];
    exist = [manager fileExistsAtPath:filepath isDirectory: &isDir];
    if (exist) {
        // 路径存在 + 路径是一个文件夹
        if (isDir) {
            return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"path is folder: %@", filepath], nil);
        }
    } else if (!create) {
        // 路径不存在 + 追加写入
        return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"file not exist: %@", filepath], nil);
    } else {
        // 路径不存在 + 创建新文件
        NSString *folderPath = [filepath stringByDeletingLastPathComponent];
        exist = [manager fileExistsAtPath:folderPath isDirectory: &isDir];
        if(!exist) {
            success = [manager createDirectoryAtPath:folderPath withIntermediateDirectories:YES attributes:nil error:nil];
            if (!success) {
                return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"create folder failed: %@", folderPath], nil);
            }
        } else if (!isDir) {
            return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"folder path is a file: %@", folderPath], nil);
        }
        success = [[NSFileManager defaultManager] createFileAtPath:filepath contents:nil attributes:nil];
        if (!success) {
            return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"create file failed: %@", filepath], nil);
        }
    }
    @try {
        NSFileHandle *fp = [NSFileHandle fileHandleForUpdatingAtPath:filepath];
        if (create) {
            [fp truncateFileAtOffset:0];
        } else {
            if (nil != position) {
                NSInteger pos = [position integerValue];
                if (pos < 0) {
                    unsigned long long size = [[manager attributesOfItemAtPath:filepath error:nil] fileSize];
                    pos = size + pos;
                }
                [fp seekToFileOffset:pos];
            } else {
                [fp seekToEndOfFile];
            }
        }
        NSData *data;
        if ([encoding isEqualToString:@"base64"]){
            data = [[NSData alloc] initWithBase64EncodedString:origin options:NSDataBase64DecodingIgnoreUnknownCharacters];
        } else if ([encoding isEqualToString:@"blob"]) {
            RCTBlobManager *blobManager = [self.bridge moduleForName:@"BlobModule"];
            NSArray *blob = [origin componentsSeparatedByString:@"#"];
            data = [blobManager resolve:blob[0] offset:[blob[1] integerValue] size:[blob[2] integerValue]];
        } else {
            data = [origin dataUsingEncoding:NSUTF8StringEncoding];
        }
        [fp writeData:data];
        return resolve([NSNull null]);
    } @catch (NSException *exception) {
        return reject(RCTErrorUnspecified, [exception reason], nil);
    }
}

// todo: options.file 兼容 scheme://
RCT_EXPORT_METHOD(readFile:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSString *file = options[@"file"];
    if ([file length] == 0) {
        return reject(RCTErrorMissing, @"missing file argument", nil);
    }
    NSString *encoding = [options objectForKey:@"encoding"];
    NSNumber *length = [options objectForKey:@"length"];
    NSNumber *position = [options objectForKey:@"position"];
    NSFileManager *manager = [NSFileManager defaultManager];
    
    // 文件校验
    if (![manager fileExistsAtPath:file isDirectory:false]) {
        return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"file not exist: %@", file], nil);
    }
    NSData *content;
    if (nil == position && nil == length) {
        content = [manager contentsAtPath:file];
    } else {
        NSFileHandle *fp = [NSFileHandle fileHandleForReadingAtPath:file];
        if (nil == fp) {
            return reject(RCTErrorUnspecified, @"Could not open file for reading", nil);
        }
        if (nil != position) {
            NSInteger pos = [position integerValue];
            if (pos < 0) {
                unsigned long long size = [[manager attributesOfItemAtPath:file error:nil] fileSize];
                pos = size + pos;
            }
            [fp seekToFileOffset: pos];
        }
        if (nil != length) {
            content = [fp readDataOfLength: [length integerValue]];
        } else {
            content = [fp readDataToEndOfFile];
        }
    }
    // 内容格式
    if ([encoding isEqualToString:@"blob"]) {
        RCTBlobManager *blobManager = [self.bridge moduleForName:@"BlobModule"];
        return resolve(@{
            @"blobId": [blobManager store:content],
            @"offset": @0,
            @"size": @(content.length),
            @"type": [self getMimeType:file]
        });
    }
    NSString *data;
    if ([encoding isEqualToString:@"base64"]){
        data = [content base64EncodedStringWithOptions:NSDataBase64EncodingEndLineWithLineFeed];
    } else {
        data = [[NSString alloc] initWithData:content encoding:NSUTF8StringEncoding];
    }
    return resolve(data);
}

// todo: copyFile options.source 兼容 scheme://
RCT_EXPORT_METHOD(copyFile:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    return [self transferFile:options resolver:resolve rejecter:reject isMove:false];
}

RCT_EXPORT_METHOD(moveFile:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    return [self transferFile:options resolver:resolve rejecter:reject isMove:true];
}

- (void)transferFile:(NSDictionary *)options
            resolver:(RCTPromiseResolveBlock)resolve
            rejecter:(RCTPromiseRejectBlock)reject
              isMove:(Boolean)move
{
    NSString *source = options[@"source"];
    if ([source length] == 0) {
        return reject(RCTErrorMissing, @"missing source argument", nil);
    }
    NSString *dest = options[@"dest"];
    if ([dest length] == 0) {
        return reject(RCTErrorMissing, @"missing dest argument", nil);
    }
    BOOL success;
    NSError *error = nil;
    // 覆盖, 先判断目标文件是否存在 并 删除
    bool overwrite = [[options objectForKey:@"overwrite"] boolValue];
    NSFileManager *manager = [NSFileManager defaultManager];
    if (overwrite && [manager fileExistsAtPath:dest isDirectory: false]) {
        success = [manager removeItemAtPath:dest error:&error];
        if (!success) {
          return [self reject:reject withError:error];
        }
    }
    success = move
        ? [manager moveItemAtPath:source toPath:dest error:&error]
        : [manager copyItemAtPath:source toPath:dest error:&error];
    if (!success) {
      return [self reject:reject withError:error];
    }
    return resolve([NSNull null]);
}

RCT_EXPORT_METHOD(unlink:(NSString *)filepath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSFileManager *manager = [NSFileManager defaultManager];
    if (![manager fileExistsAtPath:filepath isDirectory: false]) {
        return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"File does not exist: %@", filepath], nil);
    }
    NSError *error = nil;
    BOOL success = [manager removeItemAtPath:filepath error:&error];
    if (!success) {
      return [self reject:reject withError:error];
    }
    return resolve([NSNull null]);
}

RCT_EXPORT_METHOD(openFile:(NSDictionary *)options
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    NSString *file = options[@"file"];
    if ([file length] == 0) {
        return reject(RCTErrorMissing, @"missing file argument", nil);
    }
    id eventBlock;
    NSNumber *reqId = options[@"reqId"];
    if (NULL != reqId) {
        typeof(self) __weak weakSelf = self;
        eventBlock = ^(NSString *event) {
            if ([event isEqualToString:@"end"]) {
                [weakSelf sendEventWithName:RCTArchivesEvent body:@{@"event": @"dismiss", @"taskId":reqId}];
            }
        };
    }
    dispatch_sync(dispatch_get_main_queue(), ^{
        DocumentPreview *documentPreview = [[DocumentPreview alloc] initWithOptions:options block:eventBlock];
        if (![documentPreview presentPreviewAnimated:true]) {
            return reject(RCTErrorUnspecified, @"open file failed", nil);
        }
        resolve([NSNull null]);
    });
}

// todo: fontPath 兼容 scheme://
RCT_EXPORT_METHOD(loadFont:(NSString *)familyName
                  fontPath:(NSString *)fontPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    /*
     1. 使用 CTFontManager(Un)registerFontsForURL 也可以注销/注册字体, 且代码更简单, 只需:
          NSURL *fontFileUrl = [NSURL fileURLWithPath:fontPath isDirectory:false];
          CTFontManagerUnregisterFontsForURL((__bridge CFTypeRef)fontFileUrl, kCTFontManagerScopeProcess, NULL);
          CTFontManagerRegisterFontsForURL((__bridge CFTypeRef)fontFileUrl, kCTFontManagerScopeProcess, NULL);
        但对于某些使用场景有问题, 比如 file1, file2 字体文件的 fontName 相同 -> 先注册 file1 -> 再注册 file2;
        此时先注销 file2 会失败, 因为 file2 并未注册; 若直接注册 file2 也会失败, 因为 fontName 已被 file1 占用;
        那么注册 file2 时, 就需要带着 file1 作为参数以便先注销, 释放 fontName 占用, 太麻烦了, 所以改用 GraphicsFont 注册/注销.
     
     2. 参考以下两个链接, 使用 [UIFont fontWithName] 方式创建字体, 会自动缓存 fontWithName 字体到内存中, 以便下次 UIFont 使用,
        若此时重新设置 fontWithName 的字体文件, 再次使用 [UIFont fontWithName] 仍然会从内存中读取, 使用上次设置的字体文件:
        https://developer.apple.com/forums/thread/82660 | https://stackoverflow.com/q/17550556
        查看 RN 源码, 发现使用的就是 [UIFont fontWithName] 方式, 所以对于已使用过的 font, 重新更换字体文件, 对 Text 组件不会生效
        https://git.io/J1gEX
        但如果使用如下代码创建字体, 则就不是从内存中获取, 而是从所设字体文件创建, 就可以生效:
          CTFontRef font = CTFontCreateWithName((CFStringRef)fontName, 14, nil);
        但考虑到在 RN 中使用到 fontFamily 的只有 Text 组件, 即不支持使用过的字体重新更换字体文件; 所以对这种情况以 reject 方式返回.
        这样做也有坏处: 若有第三方扩展组件, 不是使用 UIFont 方式创建字体, 那么以 reject 方式便无法照顾到, 需第三方扩展组件自行处理.
        改进方向: 如若找到了刷新 UIFont 函数产生的内存缓存, 则可以两方面兼顾.
    */
    @try {
        //不知道这个 bug 还在不在, 暂且留着吧
        //https://stackoverflow.com/questions/24900979/cgfontcreatewithdataprovider-hangs-in-airplane-mode
        [UIFont familyNames];
        
        // 从 fontPath 获取 fontRef
        CGFontRef fontRef;
        NSData *inData = [NSData dataWithContentsOfFile:fontPath];
        CGDataProviderRef providerRef = CGDataProviderCreateWithCFData((__bridge CFDataRef)inData);
        if (providerRef) {
            fontRef = CGFontCreateWithDataProvider(providerRef);
            CFRelease(providerRef);
        }
        if (!fontRef) {
            return reject(RCTErrorUnspecified, @"load font file failed", nil);
        }
        
        // 若已注册, 先注销原注册
        NSString *fontName;
        CGFontRef originFont;
        BOOL stillOrigin = false;
        CFStringRef fontNameRef = CGFontCopyFullName(fontRef);
        if (fontNameRef) {
            fontName = (__bridge NSString*)fontNameRef;
            originFont = CGFontCreateWithFontName(fontNameRef);
            CFRelease(fontNameRef);
        }
        if (originFont) {
            CFErrorRef ug_error;
            if (!CTFontManagerUnregisterGraphicsFont(originFont, &ug_error)) {
                CFStringRef ugDescription = CFErrorCopyDescription(ug_error);
                NSString *ugString = (__bridge NSString*)ugDescription;
                CFRelease(ug_error);
                CFRelease(ugDescription);
                CFRelease(fontRef);
                CFRelease(originFont);
                return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"unregister origin font failed: %@", ugString], nil);
            }
            // 注销后, 若字体没被 UIFont 调用过, 则此时是无法创建字体的; 否则因为已缓存到内存中, 仍可创建.
            // 此时注册新字体将无法生效, 还应该把 originFont 再重新注册回去; 因未成功注册新的字体文件, 应以 reject 方式返回
            UIFont *testFont = [UIFont fontWithName:fontName size:14];
            if (testFont) {
                stillOrigin = true;
                CFRelease(fontRef);
                fontRef = originFont;
            } else {
                CFRelease(originFont);
            }
        }
        
        // 注册新 fontRef
        CFErrorRef error;
        if (!CTFontManagerRegisterGraphicsFont(fontRef, &error)) {
            CFStringRef description = CFErrorCopyDescription(error);
            NSString *errString = (__bridge NSString*)description;
            CFRelease(error);
            CFRelease(description);
            CFRelease(fontRef);
            return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"register %@ font failed: %@", stillOrigin ? @"new" : @"origin", errString], nil);
        }
        CFRelease(fontRef);
        if (stillOrigin) {
            return reject(RCTErrorUnspecified, [NSString stringWithFormat:@"font '%@' has registered", fontName], nil);
        }
        return resolve([NSNull null]);
    } @catch (NSException *exception) {
        return reject(RCTErrorUnspecified, [exception reason], nil);
    }
}

// todo: mergePatch / unzipFile / unzipPatch / unzipDiff
typedef NS_ENUM(NSInteger, TaskType) {
    MERGE_PATCH, UNZIP_FILE, UNZIP_PATCH, UNZIP_DIFF
};

RCT_EXPORT_METHOD(mergePatch:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    return [self runTask:options resolver:resolve rejecter:reject taskType:MERGE_PATCH];
}

RCT_EXPORT_METHOD(unzipFile:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    return [self runTask:options resolver:resolve rejecter:reject taskType:UNZIP_FILE];
}

RCT_EXPORT_METHOD(unzipPatch:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    return [self runTask:options resolver:resolve rejecter:reject taskType:UNZIP_PATCH];
}

RCT_EXPORT_METHOD(unzipDiff:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    return [self runTask:options resolver:resolve rejecter:reject taskType:UNZIP_DIFF];
}

// todo: options.source / options.origin 兼容 scheme://
- (void)runTask:(NSDictionary *)options
        resolver:(RCTPromiseResolveBlock)resolve
        rejecter:(RCTPromiseRejectBlock)reject
         taskType:(TaskType)type
{
    return reject(RCTErrorMissing, @"not implemented yet", nil);
//    NSString *source = options[@"source"];
//    if ([source length] == 0) {
//        return reject(RCTErrorMissing, @"missing source argument", nil);
//    }
//    // mergePatch/unzipDiff 必须指定 origin
//    BOOL mergePatch = type == MERGE_PATCH;
//    NSString *origin = options[@"origin"];
//    if ([origin length] == 0 && (mergePatch || type == UNZIP_DIFF)) {
//        return reject(RCTErrorMissing, @"missing origin argument", nil);
//    }
//    NSString *dest = options[@"dest"];
//    if ([dest length] == 0) {
//        return reject(RCTErrorMissing, @"missing dest argument", nil);
//    }
//    NSString *md5 = [options objectForKey:@"md5"];
//    if (origin == nil) {
//        return reject(RCTErrorMissing, @"missing content argument", nil);
//    }
}

// todo: switchVersion / markSuccess
RCT_EXPORT_METHOD(switchVersion:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    return reject(RCTErrorMissing, @"switchVersion is not implemented yet", nil);
}

RCT_EXPORT_METHOD(markSuccess:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    return reject(RCTErrorMissing, @"markSuccess is not implemented yet", nil);
}
@end
