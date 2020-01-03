package com.malacca.archives;

import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

import java.io.File;
import java.lang.reflect.Field;

import android.util.Log;
import android.os.Handler;
import android.app.Activity;
import android.app.Application;
import android.content.Intent;
import android.content.Context;
import android.content.ComponentName;
import android.content.pm.PackageManager;
import androidx.annotation.NonNull;

import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.JSBundleLoader;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;

public class ArchivesModule extends ReactContextBaseJavaModule {
    public static boolean getBundleDev(Context context) {
        return ArchivesContext.getBundleDev(context.getApplicationContext());
    }

    public static String getBundleUrl(Context context, String defaultAssetsUrl) {
        return ArchivesContext.getBundleUrl(context.getApplicationContext(), defaultAssetsUrl);
    }

    /**
     * 热更版本管理
     */
    private Executor executor;
    private ReactApplicationContext rnContext;
    private final String REACT_CLASS = "ArchivesModule";

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
        return ArchivesContext.getConstants();
    }

    @ReactMethod
    public void bsPatch(ReadableMap options, final Promise promise){
        runManagerTask(options, ArchivesParams.TASK_BS_PATCH, promise);
    }

    @ReactMethod
    public void unzipFile(ReadableMap options, final Promise promise){
        runManagerTask(options, ArchivesParams.TASK_UNZIP_FILE, promise);
    }

    @ReactMethod
    public void unzipPatch(ReadableMap options, final Promise promise){
        runManagerTask(options, ArchivesParams.TASK_UNZIP_PATCH, promise);
    }

    @ReactMethod
    public void unzipDiff(ReadableMap options, final Promise promise){
        runManagerTask(options, ArchivesParams.TASK_UNZIP_DIFF, promise);
    }

    @ReactMethod
    public void switchVersion(ReadableMap options, final Promise promise) {
        try {
            ArchivesContext.switchVersion(options.hasKey("hash") ? options.getString("hash") : null);
            if (options.hasKey("restart") && options.getBoolean("restart")) {
                if (BuildConfig.DEBUG) {
                    restartApp(promise);
                } else {
                    restartActive(promise);
                }
            } else {
                promise.resolve(null);
            }
        } catch (Throwable error) {
            promise.reject(error);
        }
    }

    @ReactMethod
    public void markSuccess(){
        ArchivesContext.markSuccess();
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

    // debug 模式重启 application
    private void restartApp(final Promise promise) {
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

    private void runManagerTask(ReadableMap options, int type, final Promise promise) {
        String source_path = options.hasKey("source") ? options.getString("source") : null;
        if (source_path == null) {
            promise.reject("E_MISSING", "missing source argument");
            return;
        }
        String dest_path = options.hasKey("dest") ? options.getString("dest") : null;
        if (dest_path == null) {
            promise.reject("E_MISSING", "missing dest argument");
            return;
        }
        String origin = options.hasKey("origin") ? options.getString("origin") : null;
        if (origin == null && type == ArchivesParams.TASK_UNZIP_DIFF) {
            promise.reject("E_MISSING", "missing origin argument");
            return;
        }
        ArchivesParams params = new ArchivesParams() {
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
        };
        params.type = type;
        params.context = rnContext.getApplicationContext();
        params.origin = origin;
        params.source = new File(source_path);
        params.dest = new File(dest_path);
        params.md5 = options.hasKey("md5") ? options.getString("md5") : null;
        new ArchivesManager().executeOnExecutor(executor, params);
    }
}