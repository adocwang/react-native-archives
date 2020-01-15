package com.malacca.archives;

import java.io.File;
import java.util.Map;
import java.util.UUID;
import java.util.HashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.lang.reflect.Field;
import java.lang.reflect.Method;

import android.net.Uri;
import android.text.TextUtils;
import android.util.Log;
import android.database.Cursor;
import android.app.Activity;
import android.app.Application;
import android.app.DownloadManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Environment;
import android.content.Intent;
import android.content.Context;
import android.content.IntentFilter;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.BroadcastReceiver;
import android.content.pm.PackageManager;
import android.util.LongSparseArray;
import android.webkit.MimeTypeMap;

import androidx.annotation.NonNull;

import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.JSBundleLoader;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReadableMapKeySetIterator;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class ArchivesModule extends ReactContextBaseJavaModule {
    /**
     * 热更 js bundle 接口
     */
    public static boolean getBundleDev(Context context) {
        return ArchivesContext.getBundleDev(context.getApplicationContext());
    }

    public static String getBundleUrl(Context context, String defaultAssetsUrl) {
        return ArchivesContext.getBundleUrl(context.getApplicationContext(), defaultAssetsUrl);
    }

    /**
     * 文件管理 相关
     */
    private Executor executor;
    private final String REACT_CLASS = "ArchivesModule";
    private ReactApplicationContext rnContext;
    private BroadcastReceiver broadcastReceiver;
    private LongSparseArray<String> downloaderTask = new LongSparseArray<>();
    private DeviceEventManagerModule.RCTDeviceEventEmitter mJSModule;

    ArchivesModule(ReactApplicationContext context) {
        super(context);
        rnContext = context;
        executor = Executors.newSingleThreadExecutor();
    }

    @Override
    public @NonNull String getName() {
        return REACT_CLASS;
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();

        // 热更相关常量
        constants.put("status", ArchivesContext.getConstants(rnContext));

        // 内部存储路径
        String fileDir = rnContext.getFilesDir().getAbsolutePath();
        String cacheDir = rnContext.getCacheDir().getAbsolutePath();
        final Map<String, Object> dirs = new HashMap<>();
        dirs.put("MainBundle", rnContext.getApplicationInfo().dataDir);
        dirs.put("Document", fileDir);
        dirs.put("Library", fileDir);
        dirs.put("Caches", cacheDir);
        dirs.put("Temporary", cacheDir);
        constants.put("dirs", dirs);

        // 外部存储路径
        final Map<String, String> storage = new HashMap<>();
        File externalDirectory = rnContext.getExternalFilesDir(null);
        storage.put("AppDocument", externalDirectory == null ? null : externalDirectory.getAbsolutePath());

        File externalCachesDirectory = rnContext.getExternalCacheDir();
        storage.put("AppCaches", externalCachesDirectory == null ? null : externalCachesDirectory.getAbsolutePath());

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
        String[] input = new String[names.size()];
        for (int i = 0; i < names.size(); i++) {
            input[i] = names.getString(i);
        }
        WritableArray output = Arguments.createArray();
        for (String rs: getMimeTypeFromStr(input, true)) {
            output.pushString(rs);
        }
        promise.resolve(output);
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

    // 获取 MediaStore 的 content:// uri
    // mediaType 可以是
    //      Files
    //      Images$Media / Images$Thumbnails
    //      Audio$Media / Audio$Genres / Audio$Playlists / Audio$Artists / Audio$Artists / Audio$Albums
    //      Video$Media / Video$Thumbnails
    // name
    //      一般是  internal 或 external
    // 获取到 uri 可用于 readDir 函数
    @ReactMethod
    public void getContentUri(String mediaType, String name, final Promise promise){
        try {
            Class<?> mediaStore = Class.forName("android.provider.MediaStore$" + mediaType);
            Method method = mediaStore.getMethod("getContentUri", String.class);
            Uri uri = (Uri) method.invoke(null, name);
            promise.resolve(uri.toString());
        } catch (Throwable e) {
            promise.resolve(null);
            if (BuildConfig.DEBUG) {
                e.printStackTrace();
            }
        }
    }

    /**
     * file 支持的路径
     * 1. ContentResolver 类型
     *      ContentResolver.SCHEME_FILE [file://]/data/xx  (file scheme 可省略)
     *      ContentResolver.SCHEME_CONTENT  content://xxx
     *      ContentResolver.SCHEME_ANDROID_RESOURCE  android.resource://xxx
     * 2. 静态资源类型 (assets || drawable raw)
     *      asset://xx
     *      drawable://xxx   raw://xxx
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

    // 支持路径与 getHash 相同, 其中 file:// asset:// 支持文件夹判断
    // 返回: true(文件夹) false(文件) null(不存在)
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
                    throw new Exception("Path already exist and is not dir: " + path);
                }
                promise.resolve(null);
                return;
            }
            if (!(recursive ? file.mkdirs() : file.mkdir())) {
                throw new Exception("Created dir failed: " + path);
            }
            promise.resolve(null);
        } catch (Throwable ex) {
            promise.reject(ex);
        }
    }

    // 支持路径
    // 1. [file://]/path 文件夹路径
    // 2. asset://path  资源目录
    // 3. content://path 类型返回的数据结构与前二者不同, 会返回内容提供者所有 row 数据
    // 4. res:// 返回所有 resource 资源
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

    // 支持路径与 getHash 相同
    // 1. 通过 encoding 设置返回的数据类型  string|blob|base64
    // 2. 可通过 position 指定读取开始的位置, 可以为负数, 从文件末尾开始算起, 默认为 0, 即从开头读取
    // 3. 可通过 length 设定读取长度, 不指定则读取到结束为止
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

    private String getFilePath(String path, Promise promise, String msg) {
        Uri uri = Uri.parse(path);
        String scheme = uri.getScheme();
        if (ContentResolver.SCHEME_FILE.equals(scheme)) {
            return uri.getPath();
        } else if (scheme != null) {
            promise.reject("E_MISSING", msg + " only support file:// scheme, given: " + path);
            return null;
        }
        return path;
    }

    @ReactMethod
    public void unlink(String path, final Promise promise){
        try {
            File file = new File(path);
            if (!file.exists() || !file.isFile()) {
                throw new Exception("File does not exist: " + path);
            }
            if (!file.delete()) {
                throw new Exception("Unlink file failed: " + path);
            }
            promise.resolve(null);
        } catch (Throwable ex) {
            promise.reject(ex);
        }
    }

    @ReactMethod
    public void bsPatch(ReadableMap options, final Promise promise){
        runManagerUnzip(options, ArchivesParams.TASK.BS_PATCH, promise);
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
     * dest:  bsPatch 与 writeFile 相同, unzip 操作仅支持 file://dir
     */
    private void runManagerUnzip(ReadableMap options, ArchivesParams.TASK task, final Promise promise) {
        String source = options.hasKey("source") ? options.getString("source") : null;
        if (source == null) {
            promise.reject("E_MISSING", "missing source argument");
            return;
        }
        boolean isBsPatch = task == ArchivesParams.TASK.BS_PATCH;

        // bsDiff/unzipDiff 必须指定 origin
        String origin = options.hasKey("origin") ? options.getString("origin") : null;
        if (origin == null && (isBsPatch || task == ArchivesParams.TASK.UNZIP_DIFF)) {
            promise.reject("E_MISSING", "missing origin argument");
            return;
        }
        String dest_config = options.hasKey("dest") ? options.getString("dest") : null;
        if (dest_config == null) {
            promise.reject("E_MISSING", "missing dest argument");
            return;
        }

        if (!isBsPatch && (dest_config = getFilePath(dest_config, promise, "dest path")) == null) {
            return;
        }

        ArchivesParams params = makeArchivesParams(promise);
        params.md5 = options.hasKey("md5") ? options.getString("md5") : null;
        params.origin = origin;
        params.source = source;
        if (isBsPatch) {
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
                reload(promise);
            } else {
                promise.resolve(null);
            }
        } catch (Throwable error) {
            promise.reject(error);
        }
    }

    @ReactMethod
    public void reload(final Promise promise) {
        if (BuildConfig.DEBUG) {
            restart(promise);
        } else {
            restartActive(promise);
        }
    }

    // release 模式重载 bundle 即可
    private void restartActive(final Promise promise) {
        UiThreadUtil.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Activity activity = getCurrentActivity();
                    if (activity == null) {
                        throw new RuntimeException("get current activity failed");
                    }
                    Application application = activity.getApplication();
                    ReactInstanceManager instanceManager = ((ReactApplication) application)
                            .getReactNativeHost()
                            .getReactInstanceManager();
                    String bundleUrl = ArchivesContext.getBundleUrl(application, null);
                    try {
                        Field jsBundleField = instanceManager.getClass().getDeclaredField("mJSBundleFile");
                        jsBundleField.setAccessible(true);
                        jsBundleField.set(instanceManager, bundleUrl);
                    } catch (Throwable err) {
                        JSBundleLoader loader = JSBundleLoader.createFileLoader(bundleUrl);
                        Field loadField = instanceManager.getClass().getDeclaredField("mBundleLoader");
                        loadField.setAccessible(true);
                        loadField.set(instanceManager, loader);
                    }
                    try {
                        instanceManager.recreateReactContextInBackground();
                    } catch(Throwable err) {
                        activity.recreate();
                    }
                    promise.resolve(null);
                } catch (Throwable error) {
                    promise.reject(error);
                }
            }
        });
    }

    // 重启 app
    @ReactMethod
    private void restart(final Promise promise) {
        new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                try {
                    PackageManager packageManager = rnContext.getPackageManager();
                    Intent intent = packageManager.getLaunchIntentForPackage(rnContext.getPackageName());
                    if (intent == null) {
                        throw new RuntimeException("get current intent failed");
                    }
                    ComponentName componentName = intent.getComponent();
                    Intent mainIntent = Intent.makeRestartActivityTask(componentName);
                    rnContext.startActivity(mainIntent);
                    Runtime.getRuntime().exit(0);
                } catch (Throwable error) {
                    promise.reject(error);
                }
            }
        }, 300);
    }

    @ReactMethod
    public void markSuccess(){
        ArchivesContext.markSuccess();
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
            void onFailed(Throwable error) {
                promise.reject(error);
                if (BuildConfig.DEBUG) {
                    error.printStackTrace();
                }
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

    private void runManagerTask(ArchivesParams params, ArchivesParams.TASK task) {
        params.task = task;
        params.context = rnContext;
        new ArchivesManager().executeOnExecutor(executor, params);
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
            if (TextUtils.isEmpty(mime)) {
                mime = getMimeTypeFromStr(new String[]{url}, false)[0];
            }
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
            if (BuildConfig.DEBUG) {
                e.printStackTrace();
            }
            promise.reject(e);
        }
    }

    private void checkDownloadProgress(
            final long downloadId,
            final String taskId,
            final boolean emit
    ) {
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
                        // 没查询到, 说明触发了 complete, js 通知已下发, 直接跳出
                        if (downloaderTask.get(downloadId) == null) {
                            break;
                        }
                        if (cursor != null) {
                            cursor.close();
                        }
                        cursor = dm.query(new DownloadManager.Query().setFilterById(downloadId));
                        if (cursor == null || !cursor.moveToFirst()) {
                            throw new RuntimeException("Query download id failed");
                        }
                        // 超过 1500ms 仍处于 PENDING 状态, 直接返回失败
                        int status = cursor.getInt(cursor.getColumnIndex(DownloadManager.COLUMN_STATUS));
                        if(status == DownloadManager.STATUS_PENDING) {
                            if (System.currentTimeMillis() - startTimestamp > 1500L) {
                                throw new RuntimeException("Download timeout");
                            }
                            continue;
                        }
                        // 通知 js 下载开始了
                        if (!sendResolve) {
                            sendResolve = true;
                            WritableMap params = Arguments.createMap();
                            params.putString("taskId", taskId);
                            params.putDouble("downloadId", (double) downloadId);
                            params.putString("event", "start");
                            sendEvent(params);
                        }
                        // 不需要通知进度 || 已不在 running, 跳出
                        // 不在 running 也不通知, 若绑定了 complete, 会在那里收到通知
                        // 若未绑定, 说明不关心结果, 也不用通知
                        if (!emit || status != DownloadManager.STATUS_RUNNING) {
                            break;
                        }
                        double total = cursor.getDouble(cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                        double loaded = cursor.getDouble(cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                        double percent = 100 * loaded / total;
                        // 下载进度每达成 1% 通知一次
                        if (percent - startPercent > 1) {
                            startPercent = percent;
                            WritableMap params = Arguments.createMap();
                            params.putString("taskId", taskId);
                            params.putDouble("downloadId", (double) downloadId);
                            params.putString("event", "progress");
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
                    if (BuildConfig.DEBUG) {
                        e.printStackTrace();
                    }
                    downloaderTask.remove(downloadId);
                    WritableMap params = Arguments.createMap();
                    params.putString("taskId", taskId);
                    params.putDouble("downloadId", (double) downloadId);
                    params.putString("event", "error");
                    params.putString("error", e.getMessage());
                    sendEvent(params);
                    // 需放在 downloaderTask.remove 后面, 否则会触发 registerDownloadReceiver
                    dm.remove(downloadId);
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
                        throw new RuntimeException("Query download id failed");
                    }
                    int status = cursor.getInt(cursor.getColumnIndex(DownloadManager.COLUMN_STATUS));
                    if(status != DownloadManager.STATUS_SUCCESSFUL) {
                        throw new RuntimeException("Download failed status " + status);
                    }
                    String filePath = cursor.getString(cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI));
                    if (!ArchivesManager.fileExist(rnContext, filePath)) {
                        throw new RuntimeException("Download file " + filePath + " not exist");
                    }
                    params.putString("event", "complete");
                    params.putString("file", filePath);
                    params.putString("url", cursor.getString(cursor.getColumnIndex(DownloadManager.COLUMN_URI)));
                    params.putString("mime", cursor.getString(cursor.getColumnIndex(DownloadManager.COLUMN_MEDIA_TYPE)));
                    params.putDouble("size", cursor.getDouble(cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)));
                    params.putDouble("mtime", cursor.getDouble(cursor.getColumnIndex(DownloadManager.COLUMN_LAST_MODIFIED_TIMESTAMP)));
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

    @Override
    public void onCatalystInstanceDestroy() {
        if (broadcastReceiver != null) {
            rnContext.unregisterReceiver(broadcastReceiver);
        }
    }

    private void sendEvent(WritableMap params) {
        if (mJSModule == null) {
            mJSModule = rnContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class);
        }
        mJSModule.emit(REACT_CLASS + "Event", params);
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
            promise.reject("E_MISSING", "file not exist: " + path);
            return;
        }
        String fileName = file.getName();
        String title = options.hasKey("title") ? options.getString("title") : null;
        String des = options.hasKey("description") ? options.getString("description") : null;
        String mime = options.hasKey("mime") ? options.getString("mime") : null;
        if (TextUtils.isEmpty(title)) {
            title = fileName;
        }
        if (TextUtils.isEmpty(des)) {
            des = " ";
        }
        if (TextUtils.isEmpty(mime)) {
            mime = getMimeTypeFromStr(new String[]{fileName}, true)[0];
        }
        boolean showNotification = !options.hasKey("quiet") || !options.getBoolean("quiet");
        try {
            DownloadManager dm = (DownloadManager) rnContext.getSystemService(Context.DOWNLOAD_SERVICE);
            dm.addCompletedDownload(title, des, true, mime, path, file.length(), showNotification);
            promise.resolve(null);
        } catch (Throwable e) {
            promise.reject(e);
        }
    }

    @ReactMethod
    public void openFile(String path, String mime, final Promise promise) {
        try {
            Uri uri = Uri.parse(path);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if(Build.VERSION.SDK_INT>= Build.VERSION_CODES.N) {
                File file = new File(uri.getPath());
                uri = ArchivesProvider.getUriForFile(
                        rnContext,
                        rnContext.getPackageName() + ".archivesProvider",
                        file
                );
                intent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                if (uri.getScheme() == null) {
                    uri = Uri.parse("file://" + path);
                }
            }
            if (TextUtils.isEmpty(mime)) {
                mime = getMimeTypeFromStr(new String[]{path}, true)[0];
            }
            intent.setDataAndType(uri, mime);
            rnContext.startActivity(intent);
            promise.resolve(null);
        } catch (Throwable e) {
            if (BuildConfig.DEBUG) {
                e.printStackTrace();
            }
            promise.reject(e);
        }
    }
}