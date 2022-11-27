package com.malacca.archives;

import java.io.File;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.lang.reflect.Field;
import java.lang.reflect.Method;

import android.util.Log;
import android.util.LongSparseArray;
import android.app.Activity;
import android.app.Application;
import android.app.DownloadManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.content.Intent;
import android.content.Context;
import android.content.IntentFilter;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.BroadcastReceiver;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.text.TextUtils;
import android.database.Cursor;
import android.graphics.Typeface;
import android.webkit.MimeTypeMap;
import android.media.MediaScannerConnection;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.res.ResourcesCompat;

import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.views.text.ReactFontManager;
import com.facebook.react.bridge.JSBundleLoader;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReadableMapKeySetIterator;
import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class ArchivesModule extends ReactContextBaseJavaModule {

    // js bundle file 接口
    public static boolean useJSBundleFile(Context context) {
        return ArchivesContext.useBundleFile(context.getApplicationContext());
    }

    public static String getJSBundleFile(Context context, String fallbackBundle) {
        return ArchivesContext.getBundleFile(context.getApplicationContext(), fallbackBundle);
    }

    // 文件管理
    private final Executor executor;
    private BroadcastReceiver broadcastReceiver;
    private Map<String, Object> versionConstants;
    private final ReactApplicationContext rnContext;
    private final String REACT_CLASS = "ArchivesModule";
    private DeviceEventManagerModule.RCTDeviceEventEmitter mJSModule;
    private final LongSparseArray<String> downloaderTask = new LongSparseArray<>();

    ArchivesModule(ReactApplicationContext context) {
        super(context);
        rnContext = context;
        executor = Executors.newSingleThreadExecutor();
        versionConstants = ArchivesContext.getConstants(rnContext);
        rnContext.addActivityEventListener(new BaseActivityEventListener() {
            @Override
            public void onActivityResult(final Activity activity, final int requestCode, final int resultCode, @Nullable final Intent intent) {
                // 接收 sendIntent 的返回消息
                WritableMap params = Arguments.createMap();
                params.putString("event", "dismiss");
                params.putInt("taskId", requestCode);
                params.putInt("code", resultCode);
                try {
                    Bundle extras = null == intent ? null : intent.getExtras();
                    if (null == extras) {
                        params.putNull("data");
                    } else {
                        params.putMap("data", Arguments.fromBundle(extras));
                    }
                } catch (Throwable e) {
                    params.putNull("data");
                    if (BuildConfig.DEBUG) {
                        e.printStackTrace();
                    }
                }
                sendEvent(params);
            }
        });
    }

    @Override
    public @NonNull String getName() {
        return REACT_CLASS;
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();

        // 传递热更相关常量给 JS, 此处释放, 不能在这里通过 ArchivesContext.getConstants 获取
        // 因为 JS 发生异常有可能导致 Java 无法执行到此处, 那么会导致自动回滚失效
        if (null == versionConstants) {
            constants.put("status", ArchivesContext.getConstants(rnContext));
        } else {
            constants.put("status", versionConstants);
            versionConstants = null;
        }

        // 内部存储路径
        String fileDir = rnContext.getFilesDir().getAbsolutePath();
        String cacheDir = rnContext.getCacheDir().getAbsolutePath();
        final Map<String, Object> dirs = new HashMap<>();
        dirs.put("MainBundle", rnContext.getPackageResourcePath());
        dirs.put("Root", rnContext.getApplicationInfo().dataDir);
        dirs.put("Document", fileDir);
        dirs.put("Library", fileDir);
        dirs.put("Caches", cacheDir);
        dirs.put("Temporary", cacheDir);
        constants.put("dirs", dirs);

        // 外部存储路径
        final Map<String, String> storage = new HashMap<>();
        File externalFilesDir = rnContext.getExternalFilesDir(null);
        File externalCachesDir = rnContext.getExternalCacheDir();
        storage.put("AppRoot", externalFilesDir == null ? null : externalFilesDir.getParent());
        storage.put("AppDocument", externalFilesDir == null ? null : externalFilesDir.getAbsolutePath());
        storage.put("AppCaches", externalCachesDir == null ? null : externalCachesDir.getAbsolutePath());

        storage.put("Root", Environment.getExternalStorageDirectory().getAbsolutePath());
        storage.put("Music", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC).getAbsolutePath());
        storage.put("Podcasts", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PODCASTS).getAbsolutePath());
        storage.put("Ringtones", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_RINGTONES).getAbsolutePath());
        storage.put("Alarms", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_ALARMS).getAbsolutePath());
        storage.put("Notifications", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_NOTIFICATIONS).getAbsolutePath());
        storage.put("Picture", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES).getAbsolutePath());
        storage.put("Movie", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES).getAbsolutePath());
        storage.put("Download", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).getAbsolutePath());
        storage.put("DCIM", Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM).getAbsolutePath());
        constants.put("external", storage);
        return constants;
    }

    @ReactMethod
    public void getMimeType(ReadableArray names, Promise promise) {
        getStuffFromStr(names, promise, true);
    }

    @ReactMethod
    public void getExtension(ReadableArray names, Promise promise) {
        getStuffFromStr(names, promise, false);
    }

    private void getStuffFromStr(ReadableArray names, Promise promise, Boolean mimeType) {
        String[] input = new String[names.size()];
        for (int i = 0; i < names.size(); i++) {
            input[i] = names.getString(i);
        }
        WritableArray output = Arguments.createArray();
        for (String rs: mimeType ? getMimeTypeFromStr(input, true) : getExtensionFromStr(input)) {
            output.pushString(rs);
        }
        promise.resolve(output);
    }

    private String[] getExtensionFromStr(String[] names) {
        String[] output = new String[names.length];
        MimeTypeMap map = MimeTypeMap.getSingleton();
        for (int i = 0; i< names.length; i++) {
            String mimeType = names[i].toLowerCase();
            int index = mimeType.lastIndexOf(";");
            if (index > 0) {
                mimeType = mimeType.substring(0, index);
            }
            String extension = TextUtils.isEmpty(mimeType) ? null : map.getExtensionFromMimeType(mimeType);
            output[i] = TextUtils.isEmpty(extension) ? null : extension;
        }
        return output;
    }

    private String[] getMimeTypeFromStr(String[] names, boolean setDef) {
        String[] output = new String[names.length];
        MimeTypeMap map = MimeTypeMap.getSingleton();
        for (int i = 0; i< names.length; i++) {
            int index = names[i].lastIndexOf(".");
            String suffix = index != -1 ? names[i].substring(index + 1).toLowerCase() : null;
            String mime = TextUtils.isEmpty(suffix) ? null : map.getMimeTypeFromExtension(suffix);
            output[i] = TextUtils.isEmpty(mime) ? (setDef ? "application/octet-stream" : null) : mime;
        }
        return output;
    }

    /**
     * 获取文件 hash 值, file 支持的路径
     * 1. ContentResolver 类型
     *    ContentResolver.SCHEME_FILE [file://]/data/xx  (file scheme 可省略)
     *    ContentResolver.SCHEME_CONTENT  content://xxx
     *    ContentResolver.SCHEME_ANDROID_RESOURCE  android.resource://xxx
     * 2. 静态资源类型 (assets || drawable raw)
     *    asset://xx
     *    drawable://xxx   raw://xxx
     */
    @ReactMethod
    public void getHash(ReadableMap options, final Promise promise){
        String filepath = options.hasKey("file") ? options.getString("file") : null;
        if (filepath == null) {
            promise.reject("E_MISSING", "missing file argument");
            return;
        }
        ArchivesParams params = makeArchivesParams(promise);
        params.filepath = filepath;
        params.md5 = options.hasKey("hash") ? options.getString("hash") : null;
        runManagerTask(params, ArchivesParams.TASK.GET_HASH);
    }

    /**
     * 获取 MediaStore 的 content:// uri
     * mediaType 可以是
     *    Images$Media  / Video$Media  / Audio$Media  / Files / Downloads
     *    Audio$Artists / Audio$Albums / Audio$Genres / Audio$Playlists
     *    (Downloads 需要 API Level >= 29)
     * name
     *    一般是 internal 或 external
     */
    @ReactMethod
    public void getContentUri(String mediaType, String name, final Promise promise){
        try {
            Class<?> mediaStore = Class.forName("android.provider.MediaStore$" + mediaType);
            Method method = mediaStore.getMethod("getContentUri", String.class);
            Uri uri = (Uri) method.invoke(null, name);
            assert uri != null;
            promise.resolve(uri.toString());
        } catch (Throwable e) {
            promise.resolve(null);
            if (BuildConfig.DEBUG) {
                e.printStackTrace();
            }
        }
    }

    // 获取当前 App 私有文件的 content:// 路径, 可共享给其他 APP
    @ReactMethod
    public void getShareUri(String path, final Promise promise) {
        try {
            Uri uri = getProviderUri(Uri.parse(path).getPath());
            promise.resolve(uri.toString());
        } catch (Throwable e) {
            rejectThrowable(promise, e);
        }
    }

    private Uri getProviderUri(String filepath) {
        File file = new File(filepath);
        return ArchivesProvider.getUriForFile(
                rnContext,
                rnContext.getPackageName() + ".archivesProvider",
                file
        );
    }

    // Android 11.0+ 是否有 MANAGE_EXTERNAL_STORAGE 的权限
    @ReactMethod
    public void isExternalManager(final Promise promise){
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            promise.resolve(Environment.isExternalStorageManager());
        } else {
            promise.resolve(null);
        }
    }

    /**
     * 支持路径与 getHash 相同, 其中 file:// asset:// 支持文件夹判断
     * 返回: true(文件夹) false(文件) null(不存在)
     */
    @ReactMethod
    public void isDir(String path, final Promise promise){
        ArchivesParams params = makeArchivesParams(promise);
        params.filepath = path;
        runManagerTask(params, ArchivesParams.TASK.IS_DIR);
    }

    // 创建目录, 仅支持 file:// 类型 path
    @ReactMethod
    public void mkDir(String path, boolean recursive, final Promise promise){
        if ((path = getFilePath(path, promise, "file path")) == null) {
            return;
        }
        try {
            File file = new File(path);
            if (file.exists()) {
                if (!file.isDirectory()) {
                    throw new IOException("Path already exist and is not dir: " + path);
                }
                promise.resolve(null);
                return;
            }
            if (!(recursive ? file.mkdirs() : file.mkdir())) {
                throw new IOException("Created dir failed: " + path);
            }
            promise.resolve(null);
        } catch (Throwable e) {
            rejectThrowable(promise, e);
        }
    }

    /**
     * 读取文件夹列表, 支持路径
     * 1. [file://]/path 文件夹路径
     * 2. asset://path  资源目录
     * 3. content://path 类型返回的数据结构与前二者不同, 会返回内容提供者所有 row 数据
     * 4. drawable:// | raw:// 返回所有 resource 资源
     */
    @ReactMethod
    public void readDir(String dir, final Promise promise){
        ArchivesParams params = makeArchivesParams(promise);
        params.filepath = dir;
        runManagerTask(params, ArchivesParams.TASK.READ_DIR);
    }

    // 移除目录, 仅支持 file:// 类型 path
    @ReactMethod
    public void rmDir(String path, boolean recursive, final Promise promise){
        if ((path = getFilePath(path, promise, "file path")) == null) {
            return;
        }
        ArchivesParams params = makeArchivesParams(promise);
        params.filepath = path;
        params.append = recursive;
        runManagerTask(params, ArchivesParams.TASK.RM_DIR);
    }

    /**
     * 写文件
     * file 路径支持 ContentResolver 所有类型, 前提是所指定文件要有写入权限
     * content 支持 string / base64 string / blobId , 注意指定 encoding 搭配
     *         blobId 可以从 rn 的 Blob 对象中获取, 如 fetch 的结果 或 手动创建的 Blob 读写
     * append  是否已追加的方式写入, 默认是覆盖写入
     * position 也可以直接指定写入位置, position 为负数, 从末尾开始计算位置
     */
    @ReactMethod
    public void writeFile(ReadableMap options, final Promise promise){
        String origin = options.hasKey("content") ? options.getString("content") : null;
        if (origin == null) {
            promise.reject("E_MISSING", "missing content argument");
            return;
        }
        String filepath = options.hasKey("file") ? options.getString("file") : null;
        if (filepath == null) {
            promise.reject("E_MISSING", "missing file argument");
            return;
        }
        boolean append = options.hasKey("append") && options.getBoolean("append");
        ArchivesParams params = makeArchivesParams(promise);
        params.origin = origin;
        params.filepath = filepath;
        params.encoding = options.hasKey("encoding") ? options.getString("encoding") : null;
        params.append = append;
        params.position = !append && options.hasKey("position") ? options.getDouble("position") : null;
        runManagerTask(params, ArchivesParams.TASK.SAVE_FILE);
    }

    /**
     * 读取文件, 支持路径与 getHash 相同
     * 1. 通过 encoding 设置返回的数据类型  string|blob|base64
     * 2. 可通过 position 指定读取开始的位置, 可以为负数, 从文件末尾开始算起, 默认为 0, 即从开头读取
     * 3. 可通过 length 设定读取长度, 不指定则读取到结束为止
     */
    @ReactMethod
    public void readFile(ReadableMap options, final Promise promise){
        String filepath = options.hasKey("file") ? options.getString("file") : null;
        if (filepath == null) {
            promise.reject("E_MISSING", "missing file argument");
            return;
        }
        ArchivesParams params = makeArchivesParams(promise);
        params.filepath = filepath;
        params.encoding = options.hasKey("encoding") ? options.getString("encoding") : null;
        params.length = options.hasKey("length") ? options.getDouble("length") : null;
        params.position = options.hasKey("position") ? options.getDouble("position") : null;
        runManagerTask(params, ArchivesParams.TASK.READ_FILE);
    }

    @ReactMethod
    public void copyFile(ReadableMap options, final Promise promise){
        transferFile(options, promise, true);
    }

    @ReactMethod
    public void moveFile(ReadableMap options, final Promise promise){
        transferFile(options, promise, false);
    }

    private void transferFile(ReadableMap options, final Promise promise, boolean copy) {
        String source = options.hasKey("source") ? options.getString("source") : null;
        if (source == null) {
            promise.reject("E_MISSING", "missing source argument");
            return;
        }
        // move 操作 source 仅支持 file://
        if (!copy && (source = getFilePath(source, promise, "source path")) == null) {
            return;
        }
        String dest_config = options.hasKey("dest") ? options.getString("dest") : null;
        if (dest_config == null) {
            promise.reject("E_MISSING", "missing dest argument");
            return;
        }
        // dest 仅支持 file://
        if ((dest_config = getFilePath(dest_config, promise, "dest path")) == null) {
            return;
        }
        ArchivesParams params = makeArchivesParams(promise);
        params.source = source;
        params.dest = new File(dest_config);
        // 这里借用一下 append 字段, 可设置在 dest 已存在的情况下, 是否覆盖
        params.append = options.hasKey("overwrite") && options.getBoolean("overwrite");
        runManagerTask(params, copy ? ArchivesParams.TASK.COPY_FILE : ArchivesParams.TASK.MOVE_FILE);
    }

    // 扫描指定文件到用户相册中
    @ReactMethod
    public void scanFile(String path, final Promise promise){
        if ((path = getFilePath(path, promise, "file path")) == null) {
            return;
        }
        MediaScannerConnection.scanFile(rnContext, new String[]{path},null, (file, uri) -> {
            if (uri != null) {
                promise.resolve(uri.toString());
            } else {
                promise.reject("E_SCAN_FAILED", "Could not add image to gallery");
            }
        });
    }

    private String getFilePath(String path, Promise promise, String msg) {
        Uri uri = Uri.parse(path);
        String scheme = uri.getScheme();
        if (ContentResolver.SCHEME_FILE.equals(scheme)) {
            return uri.getPath();
        } else if (scheme != null) {
            promise.reject("E_ILLEGAL", msg + " only support file:// scheme, given: " + path);
            return null;
        }
        return path;
    }

    @ReactMethod
    public void unlink(String path, final Promise promise){
        try {
            File file = new File(path);
            if (!file.exists() || !file.isFile()) {
                throw new IOException("File does not exist: " + path);
            }
            if (!file.delete()) {
                throw new IOException("Unlink file failed: " + path);
            }
            promise.resolve(null);
        } catch (Throwable e) {
            rejectThrowable(promise, e);
        }
    }

    @ReactMethod
    public void mergePatch(ReadableMap options, final Promise promise){
        runManagerUnzip(options, ArchivesParams.TASK.MERGE_PATCH, promise);
    }

    @ReactMethod
    public void unzipFile(ReadableMap options, final Promise promise){
        runManagerUnzip(options, ArchivesParams.TASK.UNZIP_FILE, promise);
    }

    @ReactMethod
    public void unzipPatch(ReadableMap options, final Promise promise){
        runManagerUnzip(options, ArchivesParams.TASK.UNZIP_PATCH, promise);
    }

    @ReactMethod
    public void unzipDiff(ReadableMap options, final Promise promise){
        runManagerUnzip(options, ArchivesParams.TASK.UNZIP_DIFF, promise);
    }

    /**
     * source: 支持路径与 getHash 相同
     * dest:  mergePatch 与 writeFile 相同, unzip 操作仅支持 file://dir
     */
    private void runManagerUnzip(ReadableMap options, ArchivesParams.TASK task, final Promise promise) {
        String source = options.hasKey("source") ? options.getString("source") : null;
        if (source == null) {
            promise.reject("E_MISSING", "missing source argument");
            return;
        }
        // mergePatch/unzipDiff 必须指定 origin
        boolean mergePatch = task == ArchivesParams.TASK.MERGE_PATCH;
        String origin = options.hasKey("origin") ? options.getString("origin") : null;
        if (origin == null && (mergePatch || task == ArchivesParams.TASK.UNZIP_DIFF)) {
            promise.reject("E_MISSING", "missing origin argument");
            return;
        }
        String dest_config = options.hasKey("dest") ? options.getString("dest") : null;
        if (dest_config == null) {
            promise.reject("E_MISSING", "missing dest argument");
            return;
        }
        if (!mergePatch && (dest_config = getFilePath(dest_config, promise, "dest path")) == null) {
            return;
        }
        ArchivesParams params = makeArchivesParams(promise);
        params.md5 = options.hasKey("md5") ? options.getString("md5") : null;
        params.origin = origin;
        params.source = source;
        if (mergePatch) {
            params.filepath = dest_config;
        } else {
            params.dest = new File(dest_config);
        }
        runManagerTask(params, task);
    }

    @ReactMethod
    public void switchVersion(ReadableMap options, final Promise promise) {
        try {
            ArchivesContext.switchVersion(options.hasKey("hash") ? options.getString("hash") : null);
            if (options.hasKey("reload") && options.getBoolean("reload")) {
                reload(promise, true);
            } else {
                promise.resolve(null);
            }
        } catch (Throwable e) {
            rejectThrowable(promise, e);
        }
    }

    @ReactMethod
    public void markSuccess(final Promise promise){
        try {
            ArchivesContext.markSuccess();
            promise.resolve(null);
        } catch (Throwable e) {
            rejectThrowable(promise, e);
        }
    }

    @ReactMethod
    public void reinitialize(boolean reload, final Promise promise){
        try {
            ArchivesContext.reinitialize();
            if (reload) {
                reload(promise, true);
            } else {
                promise.resolve(null);
            }
            promise.resolve(null);
        } catch (Throwable e) {
            rejectThrowable(promise, e);
        }
    }

    private void runManagerTask(ArchivesParams params, ArchivesParams.TASK task) {
        params.task = task;
        params.context = rnContext;
        new ArchivesManager().executeOnExecutor(executor, params);
    }

    private ArchivesParams makeArchivesParams(final Promise promise) {
        return new ArchivesParams() {
            @Override
            void onDebug(String debug) {
                if (BuildConfig.DEBUG) {
                    Log.d(REACT_CLASS, debug);
                }
            }

            @Override
            void onFailed(Throwable e) {
                rejectThrowable(promise, e);
            }

            @Override
            void onSuccess() {
                promise.resolve(null);
            }

            @Override
            void onSuccess(Boolean result) {
                promise.resolve(result);
            }

            @Override
            void onSuccess(String result) {
                promise.resolve(result);
            }

            @Override
            void onSuccess(WritableMap result) {
                promise.resolve(result);
            }

            @Override
            void onSuccess(WritableArray result) {
                promise.resolve(result);
            }
        };
    }

    @ReactMethod
    public void reload(final Promise promise) {
        reload(promise, false);
    }

    private void reload(final Promise promise, boolean reset) {
        UiThreadUtil.runOnUiThread(() -> {
            try {
                Activity activity = getCurrentActivity();
                if (activity == null) {
                    throw new Exception("get current activity failed");
                }
                boolean hotReload = true;
                Application application = activity.getApplication();
                ReactNativeHost Host = ((ReactApplication) application).getReactNativeHost();
                ReactInstanceManager instanceManager = Host.getReactInstanceManager();
                if (reset) {
                    try {
                        // ReactInstanceManager 没有提供设置方法, 所以只能通过反射来处理
                        // 但不兼容 RN 0.50.0 之前的版本, 因为没有 mBundleLoader 这个变量
                        Class<?> managerClass = instanceManager.getClass();
                        String bundleUrl = ArchivesContext.getBundleFile(application, null);
                        Field bundleLoader = managerClass.getDeclaredField("mBundleLoader");
                        bundleLoader.setAccessible(true);
                        if (null == bundleUrl) {
                            String assertName = ArchivesManager.getBundleAssetName(Host);
                            bundleLoader.set(instanceManager, JSBundleLoader.createAssetLoader(
                                application, "assets://" + assertName, false
                            ));
                        } else {
                            bundleLoader.set(instanceManager, JSBundleLoader.createFileLoader(bundleUrl));
                        }
                        // 支持 Debug 模式下的版本切换
                        if (BuildConfig.DEBUG) {
                            if (null == bundleUrl) {
                                // 从热更版 -> Debug, 牵涉的变量无法简单通过反射重置, 所以重启 App
                                hotReload = false;
                            } else {
                                // 从 Debug -> 热更版本, 还需修改 mUseDeveloperSupport 变量
                                Field devField = managerClass.getDeclaredField("mUseDeveloperSupport");
                                devField.setAccessible(true);
                                if (devField.getBoolean(instanceManager)) {
                                    devField.set(instanceManager, false);
                                }
                            }
                        }
                    } catch (Throwable e) {
                        // runtime 重置 bundle 失败, 直接重启 APP
                        hotReload = false;
                    }
                }
                if (hotReload) {
                    try {
                        instanceManager.recreateReactContextInBackground();
                    } catch(Throwable err) {
                        activity.recreate();
                    }
                    promise.resolve(null);
                } else {
                    restart(promise);
                }
            } catch (Throwable e) {
                rejectThrowable(promise, e);
            }
        });
    }

    @ReactMethod
    private void restart(final Promise promise) {
        new Handler().postDelayed(() -> {
            try {
                PackageManager packageManager = rnContext.getPackageManager();
                Intent intent = packageManager.getLaunchIntentForPackage(rnContext.getPackageName());
                if (intent == null) {
                    throw new Exception("get current intent failed");
                }
                ComponentName componentName = intent.getComponent();
                Intent mainIntent = Intent.makeRestartActivityTask(componentName);
                rnContext.startActivity(mainIntent);
                Runtime.getRuntime().exit(0);
            } catch (Throwable e) {
                rejectThrowable(promise, e);
            }
        }, 250);
    }

    // 添加一个 使用系统下载器的 下载任务
    @ReactMethod
    public void addDownloadService(ReadableMap options, Promise promise) {
        String url = options.hasKey("url") ? options.getString("url") : null;
        if (url == null) {
            promise.reject("E_MISSING", "missing url argument");
            return;
        }
        Long downloadId = null;
        DownloadManager downloader = null;
        try {
            Uri uri = Uri.parse(url);
            DownloadManager.Request req = new DownloadManager.Request(uri);
            String mime = options.hasKey("mime") ? options.getString("mime") : null;
            if(!TextUtils.isEmpty(mime)) {
                req.setMimeType(mime);
            }
            if(options.hasKey("title")) {
                req.setTitle(options.getString("title"));
            }
            if(options.hasKey("description")) {
                req.setDescription(options.getString("description"));
            }
            if(options.hasKey("scannable") && options.getBoolean("scannable")) {
                req.allowScanningByMediaScanner();
            }
            if(options.hasKey("roaming")) {
                req.setAllowedOverRoaming(options.getBoolean("roaming"));
            }
            // quiet=true 需要 DOWNLOAD_WITHOUT_NOTIFICATION 权限
            if(options.hasKey("quiet") && options.getBoolean("quiet")) {
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_HIDDEN);
            } else {
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            }
            // MOBILE:1, WIFI:2, ALL:3
            if (options.hasKey("network")) {
                req.setAllowedNetworkTypes(options.getInt("network"));
            } else {
                req.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI | DownloadManager.Request.NETWORK_MOBILE);
            }
            // 默认下载到 external 私有目录(无需权限), 也可以指定为 external 公共目录, 需要有 WRITE_EXTERNAL_STORAGE 权限
            if(options.hasKey("dest")) {
                req.setDestinationUri(Uri.parse(options.getString("dest")));
            } else {
                req.setDestinationInExternalFilesDir(rnContext, "Download", uri.getLastPathSegment());
            }
            ReadableMap headers = options.hasKey("headers") ? options.getMap("headers") : null;
            if (headers != null) {
                ReadableMapKeySetIterator it = headers.keySetIterator();
                while (it.hasNextKey()) {
                    String key = it.nextKey();
                    req.addRequestHeader(key, headers.getString(key));
                }
            }
            downloader = (DownloadManager) rnContext.getSystemService(Context.DOWNLOAD_SERVICE);
            downloadId = downloader.enqueue(req);
            String taskId = UUID.randomUUID().toString();
            downloaderTask.put(downloadId, taskId);
            boolean emitProgress = options.hasKey("onProgress") && options.getBoolean("onProgress");
            checkDownloadProgress(downloadId, taskId, emitProgress);
            if (emitProgress || (options.hasKey("onComplete") && options.getBoolean("onComplete"))) {
                registerDownloadReceiver();
            }
            promise.resolve(taskId);
        } catch (Throwable e) {
            if (downloader != null && downloadId != null) {
                downloader.remove(downloadId);
                downloaderTask.remove(downloadId);
            }
            rejectThrowable(promise, e);
        }
    }

    private void checkDownloadProgress(final long downloadId, final String taskId, final boolean emit) {
        (new Thread() {
            @Override
            public void run() {
                Cursor cursor = null;
                DownloadManager dm = (DownloadManager) rnContext.getSystemService(Context.DOWNLOAD_SERVICE);
                try {
                    boolean sendResolve = false;
                    double startPercent = 0;
                    long startTimestamp = System.currentTimeMillis();
                    while (true) {
                        // 没查询到, 说明已经触发 complete, js 通知已下发, 直接跳出
                        if (downloaderTask.get(downloadId) == null) {
                            break;
                        }
                        if (cursor != null) {
                            cursor.close();
                        }
                        cursor = dm.query(new DownloadManager.Query().setFilterById(downloadId));
                        if (cursor == null || !cursor.moveToFirst()) {
                            throw new Exception("Query download id failed");
                        }
                        // 超过 1500ms 仍处于 PENDING 状态, 直接返回失败
                        int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                        if(status == DownloadManager.STATUS_PENDING) {
                            if (System.currentTimeMillis() - startTimestamp > 1500L) {
                                throw new Exception("Download timeout");
                            }
                            continue;
                        }
                        // 通知 js 下载开始了
                        if (!sendResolve) {
                            sendResolve = true;
                            WritableMap params = Arguments.createMap();
                            params.putString("event", "start");
                            params.putString("taskId", taskId);
                            params.putDouble("downloadId", (double) downloadId);
                            sendEvent(params);
                        }
                        // 不需要通知进度 || 已不在 running, 跳出
                        // 不在 running 也不通知, 若绑定了 complete, 会在那里收到通知
                        // 若未绑定, 说明不关心结果, 也不用通知
                        if (!emit || status != DownloadManager.STATUS_RUNNING) {
                            break;
                        }
                        double total = cursor.getDouble(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                        double loaded = cursor.getDouble(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                        double percent = 100 * loaded / total;
                        // 下载进度每达成 1% 通知一次
                        if (percent - startPercent > 1) {
                            startPercent = percent;
                            WritableMap params = Arguments.createMap();
                            params.putString("event", "progress");
                            params.putString("taskId", taskId);
                            params.putDouble("downloadId", (double) downloadId);
                            params.putDouble("total", total);
                            params.putDouble("loaded", loaded);
                            params.putDouble("percent", percent);
                            sendEvent(params);
                        }
                        if (percent >= 100) {
                            break;
                        }
                    }
                } catch (Throwable e) {
                    downloaderTask.remove(downloadId);
                    WritableMap params = Arguments.createMap();
                    params.putString("event", "error");
                    params.putString("taskId", taskId);
                    params.putDouble("downloadId", (double) downloadId);
                    params.putString("error", e.getMessage());
                    sendEvent(params);
                    // 需放在 downloaderTask.remove 后面, 否则会触发 registerDownloadReceiver
                    dm.remove(downloadId);
                    if (BuildConfig.DEBUG) {
                        e.printStackTrace();
                    }
                } finally {
                    if (cursor != null) {
                        cursor.close();
                    }
                }
            }
        }).start();
    }

    private void registerDownloadReceiver() {
        if (broadcastReceiver != null) {
            return;
        }
        broadcastReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                Bundle bundle = DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())
                        ? intent.getExtras() : null;
                if (bundle == null) {
                    return;
                }
                long downloadId = bundle.getLong(DownloadManager.EXTRA_DOWNLOAD_ID);
                String taskId = downloaderTask.get(downloadId);
                if (taskId == null) {
                    return;
                }
                WritableMap params = Arguments.createMap();
                params.putString("taskId", taskId);
                params.putDouble("downloadId", (double) downloadId);
                Cursor cursor = null;
                try {
                    DownloadManager dm = (DownloadManager) rnContext.getSystemService(Context.DOWNLOAD_SERVICE);
                    cursor = dm.query(new DownloadManager.Query().setFilterById(downloadId));
                    if (cursor == null || !cursor.moveToFirst()) {
                        throw new Exception("Query download id failed");
                    }
                    int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                    if(status != DownloadManager.STATUS_SUCCESSFUL) {
                        throw new Exception("Download failed status " + status);
                    }
                    String filePath = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI));
                    if (!ArchivesManager.fileExist(rnContext, filePath)) {
                        throw new Exception("Download file " + filePath + " not exist");
                    }
                    params.putString("event", "complete");
                    params.putString("file", filePath);
                    params.putString("url", cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_URI)));
                    params.putString("mime", cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_MEDIA_TYPE)));
                    params.putDouble("size", cursor.getDouble(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)));
                    params.putDouble("mtime", cursor.getDouble(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LAST_MODIFIED_TIMESTAMP)));
                } catch (Throwable e) {
                    if (BuildConfig.DEBUG) {
                        e.printStackTrace();
                    }
                    params.putString("event", "complete");
                    params.putString("error", e.getMessage());
                } finally {
                    if (cursor != null) {
                        cursor.close();
                    }
                }
                sendEvent(params);
            }
        };
        IntentFilter intentFilter = new IntentFilter();
        intentFilter.addAction(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        rnContext.registerReceiver(broadcastReceiver, intentFilter);
    }

    private void sendEvent(WritableMap params) {
        if (mJSModule == null) {
            mJSModule = rnContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class);
        }
        mJSModule.emit(REACT_CLASS + "Event", params);
    }

    @Override
    public void onCatalystInstanceDestroy() {
        if (broadcastReceiver != null) {
            rnContext.unregisterReceiver(broadcastReceiver);
        }
    }

    @ReactMethod
    public void addDownloadComplete(ReadableMap options, Promise promise) {
        String path = options.hasKey("file") ? options.getString("file") : null;
        if (path == null) {
            promise.reject("E_MISSING", "missing path argument");
            return;
        }
        // 仅支持 file://
        if ((path = getFilePath(path, promise, "file path")) == null) {
            return;
        }
        File file = new File(path);
        if (!file.exists() || !file.isFile()) {
            promise.reject("E_ILLEGAL", "file not exist: " + path);
            return;
        }
        String fileName = file.getName();
        String title = options.hasKey("title") ? options.getString("title") : null;
        String mime = options.hasKey("mime") ? options.getString("mime") : null;
        String des = options.hasKey("description") ? options.getString("description") : null;
        if (TextUtils.isEmpty(title)) {
            title = fileName;
        }
        if (TextUtils.isEmpty(mime)) {
            mime = getMimeTypeFromStr(new String[]{fileName}, true)[0];
        }
        if (TextUtils.isEmpty(des)) {
            des = " ";
        }
        boolean showNotification = !options.hasKey("quiet") || !options.getBoolean("quiet");
        try {
            DownloadManager dm = (DownloadManager) rnContext.getSystemService(Context.DOWNLOAD_SERVICE);
            dm.addCompletedDownload(title, des, true, mime, path, file.length(), showNotification);
            promise.resolve(null);
        } catch (Throwable e) {
            rejectThrowable(promise, e);
        }
    }

    @ReactMethod
    public void loadFont(final String fontFamilyName, final String fontPath, final Promise promise) {
        try {
            Typeface typeface;
            Uri uri = Uri.parse(fontPath);
            ArchivesManager.URI_TYPE type = ArchivesManager.getUriType(uri);
            switch (type) {
                case FILE:
                    typeface = Typeface.createFromFile(new File(uri.getPath()));
                    break;
                case RAW:
                case DRAWABLE:
                    // 理论上来讲, drawable 目录中就不应该存在 font 文件, 这里仅是顺手加上了
                    int identifier = rnContext.getResources().getIdentifier(
                            ArchivesManager.removePathDash(uri.getSchemeSpecificPart()),
                            uri.getScheme(),
                            rnContext.getPackageName()
                    );
                    typeface = ResourcesCompat.getFont(rnContext, identifier);
                    break;
                case ASSET:
                    typeface = Typeface.createFromAsset(
                            rnContext.getAssets(),
                            ArchivesManager.removePathDash(uri.getSchemeSpecificPart())
                    );
                    break;
                default:
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        ParcelFileDescriptor descriptor = rnContext.getContentResolver().openFileDescriptor(uri, "r");
                        if (descriptor != null) {
                            typeface = new Typeface.Builder(descriptor.getFileDescriptor()).build();
                            descriptor.close();
                        } else {
                            throw new IOException("could not open an output stream for '" + fontPath + "'");
                        }
                    } else {
                        throw new IOException("Create font from content uri requires API level 26");
                    }
                    break;
            }
            if (typeface == null) {
                throw new IOException("Create font typeface failed");
            }
            ReactFontManager.getInstance().setTypeface(fontFamilyName, Typeface.NORMAL, typeface);
            promise.resolve(null);
        } catch (Throwable e) {
            rejectThrowable(promise, e);
        }
    }

    @ReactMethod
    public void sendIntent(ReadableMap options, final Promise promise) {
        String action = options.hasKey("action") ? options.getString("action") : null;
        if (action == null || action.isEmpty()) {
            promise.reject("E_MISSING", "missing action argument");
            return;
        }
        try {
            Activity activity = getCurrentActivity();
            if (activity == null) {
                throw new Exception("get current activity failed");
            }
            Intent intent = new Intent();
            intent.setAction(getClassFieldValue(action));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                String identifier = options.hasKey("identifier") ? options.getString("identifier") : null;
                if (!TextUtils.isEmpty(identifier)) {
                    intent.setIdentifier(identifier);
                }
            }
            ReadableArray categories = options.hasKey("categories") ? options.getArray("categories") : null;
            if (categories != null) {
                for (int i = 0; i < categories.size(); i++) {
                    intent.addCategory(getClassFieldValue(categories.getString(i)));
                }
            }
            String packageName = options.hasKey("package") ? options.getString("package") : null;
            if (!TextUtils.isEmpty(packageName)) {
                intent.setPackage(packageName);
            }
            String component = options.hasKey("component") ? options.getString("component") : null;
            if (component != null && !component.isEmpty()) {
                int splitIndex = component.indexOf("/");
                if (splitIndex > 0) {
                    intent.setComponent(new ComponentName(
                            component.substring(0, splitIndex), component.substring((splitIndex+1))
                    ));
                }
            }
            // 除了使用 setData, 还有一个 setClipData 可设置多个 data, 没整明白使用场景, 这里先不做处理了
            String data = options.hasKey("data") ? options.getString("data") : null;
            String type = options.hasKey("type") ? options.getString("type") : null;
            if (!TextUtils.isEmpty(type) && !TextUtils.isEmpty(data)) {
                intent.setDataAndType(Uri.parse(data), type);
            } else if (!TextUtils.isEmpty(data)) {
                intent.setData(Uri.parse(data));
            } else if (!TextUtils.isEmpty(type)) {
                intent.setType(type);
            }
            // extras:[{key:String, value:String|Number|Bool|Array}, type:"uri|int|string"]
            ReadableArray extras = options.hasKey("extras") ? options.getArray("extras") : null;
            if (extras != null) {
                for(int i = 0; i < extras.size(); ++i) {
                    ReadableMap map = extras.getMap(i);
                    String name = map.hasKey("key") ? map.getString("key") : null;
                    if (TextUtils.isEmpty(name)) {
                        continue;
                    }
                    ReadableType valType = map.getType("value");
                    String assType = map.hasKey("type") ? map.getString("type") : null;
                    switch(valType) {
                        case Boolean:
                            intent.putExtra(name, map.getBoolean("value"));
                            break;
                        case Number:
                            if ("int".equals(assType)) {
                                intent.putExtra(name, map.getInt("value"));
                            } else {
                                intent.putExtra(name, map.getDouble("value"));
                            }
                            break;
                        case String:
                            String val = map.getString("value");
                            if ("uri".equals(assType)) {
                                intent.putExtra(name, Uri.parse(val));
                            } else {
                                intent.putExtra(name,  val);
                            }
                            break;
                        case Array:
                            ReadableArray lists = map.getArray("value");
                            if (lists == null || lists.size() < 1) {
                                break;
                            }
                            if ("int".equals(assType)) {
                                ArrayList<Integer> initData = new ArrayList<>();
                                for(int j = 0; j < lists.size(); ++j) {
                                    initData.add(lists.getInt(j));
                                }
                                intent.putIntegerArrayListExtra(name, initData);
                            } else if ("uri".equals(assType)) {
                                ArrayList<Uri> initData = new ArrayList<>();
                                for(int j = 0; j < lists.size(); ++j) {
                                    initData.add(Uri.parse(lists.getString(j)));
                                }
                                intent.putParcelableArrayListExtra(name, initData);
                            } else {
                                ArrayList<String> initData = new ArrayList<>();
                                for(int j = 0; j < lists.size(); ++j) {
                                    initData.add(lists.getString(j));
                                }
                                intent.putStringArrayListExtra(name, initData);
                            }
                            break;
                        default:
                            throw new Exception("Extra type for " + name + " not supported.");
                    }
                }
            }
            // Flag
            ReadableArray flags = options.hasKey("flag") ? options.getArray("flag") : null;
            if (flags != null && flags.size() > 0) {
                Class<?> mediaStore = intent.getClass();
                for(int i = 0; i < flags.size(); ++i) {
                    intent.addFlags(mediaStore.getDeclaredField(flags.getString(i)).getInt(intent));
                }
            }
            int reqId = options.hasKey("reqId") ? options.getInt("reqId") : 0;
            if (reqId > 0) {
                activity.startActivityForResult(intent, reqId);
            } else {
                activity.startActivity(intent);
            }
            promise.resolve(null);
        } catch (Throwable e) {
            rejectThrowable(promise, e);
        }
    }

    private static String getClassFieldValue(String className) throws Throwable {
        int splitIndex = className.indexOf("$");
        if (splitIndex < 1) {
            return className;
        }
        Class<?> mediaStore = Class.forName(className.substring(0, splitIndex));
        Field field = mediaStore.getDeclaredField(className.substring(splitIndex + 1));
        return (String) field.get(mediaStore);
    }

    private static void rejectThrowable(final Promise promise, Throwable e) {
        promise.reject(e);
        if (BuildConfig.DEBUG) {
            e.printStackTrace();
        }
    }
}