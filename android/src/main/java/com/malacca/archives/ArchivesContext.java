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
    private static SharedPreferences sp;
    private static String packageVersion;

    private static void init(Context context) {
        if (sp != null) {
            return;
        }
        sp = context.getSharedPreferences("epush", Context.MODE_PRIVATE);
        rootDir = new File(context.getFilesDir(), "_epush");
        if (!rootDir.exists() && !rootDir.mkdir()) {
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
        if (packageVersion == null || !packageVersion.equals(sp.getString("packageVersion", null)) ) {
            clearSpData();
            clearUp();
        }
    }

    static boolean getBundleDev(Context context) {
        if (!BuildConfig.DEBUG) {
            return false;
        }
        init(context);
        String currentVersion = getCurrentVersion();
        if (currentVersion != null
                && !sp.getBoolean("firstTime", false)
                && !sp.getBoolean("firstTimeOk", false)
        ) {
            currentVersion = sp.getString("lastVersion", null);
        }
        File bundle = currentVersion == null ? null :
                new File(rootDir, currentVersion+"/index.bundlejs");
        return bundle == null || !bundle.exists() || !bundle.isFile();
    }

    static String getBundleUrl(Context context, String defaultAssetsUrl) {
        init(context);
        // 非首次运行 && 未被标记为成功, 自动回滚
        String currentVersion = getCurrentVersion();
        if (currentVersion != null &&
                !sp.getBoolean("firstTime", false) &&
                !sp.getBoolean("firstTimeOk", false)
        ) {
            currentVersion = sp.getString("lastVersion", null);
            SharedPreferences.Editor editor = sp.edit();
            if (currentVersion == null) {
                editor.remove("currentVersion");
            } else {
                editor.putString("currentVersion", currentVersion);
            }
            editor.putBoolean("firstTime", false);
            editor.putBoolean("firstTimeOk", true);
            editor.putBoolean("rolledBack", true);
            editor.apply();
        }
        if (currentVersion == null) {
            return defaultAssetsUrl;
        }
        File bundle = new File(rootDir, currentVersion+"/index.bundlejs");
        if (bundle.isFile() && bundle.exists()) {
            return bundle.toString();
        }
        clearSpData();
        return null;
    }

    static String getRootDir() {
        return rootDir.getAbsolutePath();
    }

    static Map<String, Object> getConstants(Context context) {
        init(context);
        String currentVersion = getCurrentVersion();
        boolean isFirstTime = sp.getBoolean("firstTime", false);
        boolean isRolledBack = sp.getBoolean("rolledBack", false);
        final Map<String, Object> constants = new HashMap<>();
        constants.put("downloadRootDir", getRootDir());
        constants.put("packageVersion", packageVersion);
        constants.put("currentVersion", currentVersion);
        constants.put("isFirstTime", isFirstTime);
        constants.put("isRolledBack", isRolledBack);
        if (BuildConfig.DEBUG) {
            // debug 模式下, 仅支持一次, 重启 app 就还原
            clearSpData();
        } else if (isFirstTime || isRolledBack) {
            SharedPreferences.Editor editor = sp.edit();
            if (isFirstTime) {
                editor.putBoolean("firstTime", false);
            }
            if (isRolledBack) {
                editor.putBoolean("rolledBack", false);
            }
            editor.apply();
            clearUp();
        }
        return constants;
    }

    static void switchVersion(String hashName) throws IllegalArgumentException {
        if (hashName == null || !new File(rootDir, hashName).exists()) {
            throw new IllegalArgumentException("Hash name not found, must download first.");
        }
        String lastVersion = getCurrentVersion();
        SharedPreferences.Editor editor = sp.edit();
        editor.putString("currentVersion", hashName);
        if (lastVersion != null) {
            editor.putString("lastVersion", lastVersion);
        }
        editor.putBoolean("firstTime", true); // 首次运行
        editor.putBoolean("firstTimeOk", false); // 尚未校验
        editor.putBoolean("rolledBack", false);  // 无需回滚
        editor.apply();
    }

    static void markSuccess() {
        SharedPreferences.Editor editor = sp.edit();
        editor.putBoolean("firstTimeOk", true); // 标记为已校验, 正式生效
        editor.remove("lastVersion");
        editor.apply();
        clearUp();
    }

    private static String getCurrentVersion() {
        return sp.getString("currentVersion", null);
    }

    private static void clearSpData() {
        SharedPreferences.Editor editor = sp.edit();
        editor.clear();
        if (packageVersion != null) {
            editor.putString("packageVersion", packageVersion);
        }
        editor.apply();
    }

    private static void clearUp() {
        (new Thread() {
            @Override
            public void run() {
                try {
                    doClearUp();
                } catch (IOException err) {
                    err.printStackTrace();
                }
            }
        }).start();
    }

    private static void doClearUp() throws IOException {
        String currentVersion = getCurrentVersion();
        String lastVersion = sp.getString("lastVersion", null);
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
    }
}
