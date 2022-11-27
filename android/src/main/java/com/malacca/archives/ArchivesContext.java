package com.malacca.archives;

import java.io.File;
import java.io.IOException;

import java.util.Map;
import java.util.HashMap;
import java.util.Objects;

import android.util.Log;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;

/**
 * 读写热更信息
 */
class ArchivesContext {
    private static File rootDir;
    private static String packageVersion;
    private static SharedPreferences sharedPreferences;

    private static void init(Context context) {
        if (sharedPreferences != null) {
            return;
        }
        rootDir = new File(context.getFilesDir(), "epush");
        sharedPreferences = context.getSharedPreferences("epush", Context.MODE_PRIVATE);
        if (!rootDir.exists() && !rootDir.mkdir()) {
            rootDir = null;
            Log.e("ArchivesContext", "Create ArchivesContext root dir failed");
        }
        try {
            packageVersion = context
                    .getPackageManager()
                    .getPackageInfo(context.getPackageName(), 0)
                    .versionName;
        } catch( PackageManager.NameNotFoundException e) {
            e.printStackTrace();
        }
        // bundle 文件夹创建失败 或 冷版本不符, 重置配置并清空 bundle
        if (null == rootDir || null == packageVersion ||
                !packageVersion.equals(sharedPreferences.getString("packageVersion", null))
        ) {
            clearSpData();
            clearIdleBundle();
        }
    }

    // 获取当前热更的版本号
    private static String getCurrentVersion() {
        return sharedPreferences.getString("currentVersion", null);
    }

    // 若配置中记录的版本号与当前不符, 重置配置数据
    private static void clearSpData() {
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.clear();
        if (packageVersion != null) {
            editor.putString("packageVersion", packageVersion);
        }
        editor.apply();
    }

    // 清除不再使用的 Bundle 文件
    private static void clearIdleBundle() {
        if (null == rootDir) {
            return;
        }
        (new Thread() {
            @Override
            public void run() {
                try {
                    String currentVersion = getCurrentVersion();
                    String lastVersion = sharedPreferences.getString("lastVersion", null);
                    for (File sub : Objects.requireNonNull(rootDir.listFiles())) {
                        if (sub.getName().charAt(0) == '.') {
                            continue;
                        }
                        if (sub.isFile()) {
                            //noinspection ResultOfMethodCallIgnored
                            sub.delete();
                            continue;
                        }
                        String name = sub.getName();
                        if (name.equals(currentVersion) || name.equals(lastVersion)) {
                            continue;
                        }
                        ArchivesManager.removeDirectory(sub);
                    }
                } catch (IOException err) {
                    err.printStackTrace();
                }
            }
        }).start();
    }

    // 保存热更版本 bundle 文件的根目录
    static String getRootDir() {
        return null == rootDir ? null : rootDir.getAbsolutePath();
    }

    // 获取热更相关的信息
    static Map<String, Object> getConstants(Context context) {
        init(context);
        String currentVersion = getCurrentVersion();
        boolean isFirstTime = sharedPreferences.getBoolean("isFirstTime", false);
        String rolledVersion = sharedPreferences.getString("rolledVersion", null);
        final Map<String, Object> constants = new HashMap<>();
        constants.put("downloadRootDir", getRootDir());
        constants.put("packageName", context.getPackageName());
        constants.put("packageVersion", packageVersion);
        constants.put("currentVersion", currentVersion);
        constants.put("rolledVersion", rolledVersion);
        constants.put("isFirstTime", isFirstTime);
        // 若是 当前热更版本首次启动 或 回滚后版本首次启动, 重置信息
        if (isFirstTime || rolledVersion != null) {
            SharedPreferences.Editor editor = sharedPreferences.edit();
            if (isFirstTime) {
                editor.putBoolean("isFirstTime", false);
            }
            if (rolledVersion != null) {
                editor.remove("rolledVersion");
            }
            editor.apply();
            clearIdleBundle();
        }
        return constants;
    }

    // 重新初始化, 清除所有热更版本
    static void reinitialize() {
        clearSpData();
        clearIdleBundle();
    }

    // 切换到指定的热更版本
    static void switchVersion(String hashName) throws IllegalArgumentException {
        if (null == rootDir || null == hashName || !new File(rootDir, hashName).exists()) {
            throw new IllegalArgumentException("Patch file not found, must download first.");
        }
        String lastVersion = getCurrentVersion();
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.putString("currentVersion", hashName);
        // 保存切换前的热更版本号, 以便在切换后发生异常, 可以回滚
        if (null == lastVersion) {
            editor.remove("lastVersion");
        } else {
            editor.putString("lastVersion", lastVersion);
        }
        // 设置当前热更版本的信息
        editor.remove("rolledVersion");  // 标记回滚版本为空
        editor.putBoolean("isFirstTime", true);  // 标记为首次运行
        editor.putBoolean("firstTimeOk", false);  // 标记为未校验
        editor.apply();
    }

    // 首次启动新的热更版本, 若无异常, 需调用该函数正式生效, 否则下次启动会回滚到前一个版本
    static void markSuccess() {
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.putBoolean("firstTimeOk", true); // 标记为已校验, 正式生效
        editor.remove("lastVersion");
        editor.apply();
        clearIdleBundle();
    }

    // 确认是否使用热更版本的 JsBundle 地址
    static boolean useBundleFile(Context context) {
        return null != getJSFile(context, null, true);
    }

    // 获取热更版本的 JsBundle 地址
    static String getBundleFile(Context context, String fallbackBundle) {
        return getJSFile(context, fallbackBundle, false);
    }

    // 切换版本并重新加载的执行逻辑顺序为: switchVersion -> getBundleFile -> getConstants -> [markSuccess]
    // 以后正常启动APP的执行逻辑顺序为: getBundleFile -> getConstants
    private static String getJSFile(Context context, String fallbackBundle, boolean onlyCheck) {
        init(context);
        if (null == rootDir) {
            return fallbackBundle;
        }
        String currentVersion = getCurrentVersion();
        // 当前使用的是热更版本 && 不是首次运行 && 未标记为已校验 -> 需自动回滚
        if (currentVersion != null
                && !sharedPreferences.getBoolean("isFirstTime", false)
                && !sharedPreferences.getBoolean("firstTimeOk", false)
        ) {
            String lastVersion = sharedPreferences.getString("lastVersion", null);
            if (!onlyCheck) {
                SharedPreferences.Editor editor = sharedPreferences.edit();
                if (null == lastVersion) {
                    editor.remove("currentVersion");
                } else {
                    editor.putString("currentVersion", lastVersion);
                }
                editor.putBoolean("isFirstTime", false);
                editor.putBoolean("firstTimeOk", true);
                editor.putString("rolledVersion", currentVersion);
                editor.apply();
            }
            currentVersion = lastVersion;
        }
        if (null == currentVersion) {
            return fallbackBundle;
        }
        File bundle = new File(rootDir, currentVersion+"/index.bundlejs");
        if (bundle.isFile() && bundle.exists()) {
            return bundle.toString();
        }
        if (!onlyCheck) {
            clearSpData();
        }
        return fallbackBundle;
    }
}
