package com.malacca.archives;

import org.json.JSONObject;
import org.json.JSONTokener;
import org.json.JSONException;

import java.util.HashMap;
import java.util.Iterator;
import java.util.ArrayList;
import java.util.Objects;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.lang.reflect.Method;
import java.lang.reflect.Field;
import java.security.MessageDigest;

import android.net.Uri;
import android.text.TextUtils;
import android.util.Base64;
import android.database.Cursor;
import android.webkit.MimeTypeMap;
import android.provider.BaseColumns;
import android.provider.OpenableColumns;
import android.os.AsyncTask;
import android.os.ParcelFileDescriptor;
import android.content.Context;
import android.content.ContentUris;
import android.content.res.Resources;
import android.content.ContentResolver;
import android.content.res.AssetManager;
import android.content.res.AssetFileDescriptor;

import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.modules.blob.BlobModule;

/**
 * Created by tdzl2003 on 3/31/16.
 * https://git.io/JeAjO
 * 做了一些变动, 移除了下载相关的代码, 仅保留了解压热更包等相关代码
 * 另外添加了 文件管理 相关的操作
 */
class ArchivesManager extends AsyncTask<ArchivesParams, Void, Void> {
    enum URI_TYPE {
        FILE,
        ASSET,
        RAW,
        DRAWABLE,
        CONTENT,
    }
    private static final byte[] buffer = new byte[1024];

    // 获取 React native 的 asset bundle 文件名
    static String getBundleAssetName(ReactNativeHost Host) {
        try {
            Method assetMethod = getDeclaredMethod(Host.getClass(), "getBundleAssetName");
            assetMethod.setAccessible(true);
            return (String) assetMethod.invoke(Host);
        } catch (Throwable e) {
            return "index.android.bundle";
        }
    }

    private static Method getDeclaredMethod(Class<?> clazz, String name) throws NoSuchMethodException {
        try {
            return clazz.getDeclaredMethod(name);
        } catch (Throwable e) {
            Class<?> superClass = clazz.getSuperclass();
            if (null == superClass) {
                throw e;
            }
            return getDeclaredMethod(superClass, name);
        }
    }

    static URI_TYPE getUriType(Uri uri) {
        String scheme = uri.getScheme();
        if (scheme == null || ContentResolver.SCHEME_FILE.equals(scheme)) {
            return URI_TYPE.FILE;
        } else if ("asset".equals(scheme)) {
            return URI_TYPE.ASSET;
        } else if ("drawable".equals(scheme)) {
            return URI_TYPE.DRAWABLE;
        } else if ("raw".equals(scheme)) {
            return URI_TYPE.RAW;
        }
        return URI_TYPE.CONTENT;
    }

    static String removePathDash(String realPath) {
        int from = 0;
        char dash = "/".charAt(0);
        for (int i = 0; i < realPath.length(); i++) {
            if (realPath.charAt(i) == dash) {
                from = i;
            } else {
                break;
            }
        }
        from += 1;
        return realPath.substring(from);
    }

    // 创建上级文件夹
    private static void makeParent(File file, boolean overwrite) throws IOException {
        if (file.exists()) {
            if (!overwrite) {
                throw new IOException("File already exist '" + file.getAbsolutePath() + "'");
            }
            return;
        }
        File dir = file.getParentFile();
        if (null == dir || (!dir.exists() && !dir.mkdirs())) {
            throw new IOException("Failed to create parent directory of '" + file.getAbsolutePath() + "'");
        }
    }

    // 由 路径 获得可读的 InputStream
    private static InputStream getInputStream(Context context, String path) throws IOException {
        Uri uri = Uri.parse(path);
        URI_TYPE type = getUriType(uri);
        // file://
        if (URI_TYPE.FILE == type) {
            return new FileInputStream(uri.getPath());
        }
        // content:// || android.resource://
        if (URI_TYPE.CONTENT == type) {
            ParcelFileDescriptor descriptor = context.getContentResolver()
                    .openFileDescriptor(uri, "r");
            if (descriptor == null) {
                throw new IOException("could not open an output stream for '" + path + "'");
            }
            return new FileInputStream(descriptor.getFileDescriptor());
        }
        path = removePathDash(uri.getSchemeSpecificPart());
        // asset://
        if (URI_TYPE.ASSET == type) {
            return context.getAssets().open(path, 0);
        }
        // raw:// || drawable://
        Resources resources = context.getResources();
        return resources.openRawResource(resources.getIdentifier(
                path, uri.getScheme(), context.getPackageName()
        ));
    }

    // 由可读 InputStream 获得 byte
    private static byte[] readInputStream(InputStream in) throws IOException {
        int count;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        while ((count = in.read(buffer)) != -1)  {
            out.write(buffer, 0, count);
        }
        out.close();
        in.close();
        return out.toByteArray();
    }

    // 由 路径 获取可写的 FileOutputStream
    private static FileOutputStream getFileOutputStream(Context context, String path, boolean append) throws IOException {
        Uri uri = Uri.parse(path);
        URI_TYPE type = getUriType(uri);
        // file://
        if (type == URI_TYPE.FILE) {
            File file = new File(uri.getPath());
            if (file.isDirectory()) {
                throw new IOException("Illegal operation on a directory, read '" + path + "'");
            }
            makeParent(file, true);
            if (!append) {
                return new FileOutputStream(file);
            }
            uri = Uri.parse("file://" + uri.getPath());
        }
        // content:// || android.resource://
        ParcelFileDescriptor descriptor = context.getContentResolver()
                .openFileDescriptor(uri, append ? "rw" : "rwt");
        if (descriptor == null) {
            throw new IOException("could not open an output stream for '" + path + "'");
        }
        return new FileOutputStream(descriptor.getFileDescriptor());
    }

    static boolean fileExist(Context context, String filepath) {
        boolean exist = false;
        // try-with-resources 会自动关闭 stream
        try (InputStream stream = getInputStream(context, filepath)) {
            if (stream != null) {
                //InputStream 也有可能是目录, 所以这里需 read() 一下确认是否为文件
                //noinspection ResultOfMethodCallIgnored
                stream.read();
                exist = true;
                stream.close();
            }
        } catch (Exception ignored) {}
        return exist;
    }

    static void removeDirectory(File file) throws IOException {
        removeDirectory(file, true);
    }

    private static void removeDirectory(File file, boolean recursive) throws IOException {
        if (file.isDirectory()) {
            for (File f : Objects.requireNonNull(file.listFiles())) {
                String name = f.getName();
                if (name.equals(".") || name.equals("..")) {
                    continue;
                }
                if (!recursive) {
                    throw new IOException("Directory is not empty: " + file.getAbsolutePath());
                }
                removeDirectory(f, true);
            }
        }
        if (file.exists() && !file.delete()) {
            throw new IOException("Failed to delete directory: " + file.getAbsolutePath());
        }
    }

    private static String getHash(ArchivesParams param) throws IOException {
        InputStream stream = getInputStream(param.context, param.filepath);
        String hash = getHashFromStream(stream, param.md5 == null ? "MD5" : param.md5, false);
        stream.close();
        return hash;
    }

    // 如果可正常返回,不要关闭 stream, 后续要继续使用; 若有异常,应关闭 stream
    private static String getHashFromStream(InputStream stream, String algorithm, boolean reset) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance(algorithm);
        } catch (Throwable e) {
            stream.close();
            throw new IOException("Failed to getting "+algorithm+" digest");
        }
        boolean isFileInput = stream instanceof FileInputStream;
        if (reset && !isFileInput) {
            stream.mark(Integer.MAX_VALUE);
        }
        int count;
        while ((count = stream.read(buffer)) != -1) {
            digest.update(buffer, 0, count);
        }
        byte[] md5Bytes = digest.digest();
        if (md5Bytes.length <= 0) {
            stream.close();
            throw new IOException("Failed to getting source md5 hash");
        }
        StringBuilder stringBuilder = new StringBuilder();
        for (byte md5Byte : md5Bytes) {
            int v = md5Byte & 0xFF;
            String hv = Integer.toHexString(v);
            if (hv.length() < 2) {
                stringBuilder.append(0);
            }
            stringBuilder.append(hv);
        }
        if (reset) {
            if (isFileInput) {
                ((FileInputStream) stream).getChannel().position(0);
            } else {
                stream.reset();
            }
        }
        return stringBuilder.toString();
    }

    private static Boolean isDir(ArchivesParams param) {
        Uri uri = Uri.parse(param.filepath);
        URI_TYPE type = getUriType(uri);
        // file://path
        if (type == URI_TYPE.FILE) {
            File file = new File(uri.getPath());
            return file.exists() ? file.isDirectory() : null;
        }
        // 先判断是否为 asset | drawable | raw | content 类型文件
        if (fileExist(param.context, param.filepath)) {
            return false;
        }
        // 再判断是否为 asset://path | content://path 文件夹
        if (type == URI_TYPE.ASSET) {
            try {
                String[] list = param.context.getAssets().list(removePathDash(uri.getSchemeSpecificPart()));
                if (list != null && list.length > 0) {
                    return true;
                }
            } catch (Throwable ignored) {
            }
        } else if (type == URI_TYPE.CONTENT) {
            try (Cursor cursor = param.context.getContentResolver().query(
                    uri, null, null, null, null
            )) {
                int size = 0;
                if (cursor != null) {
                    if (cursor.moveToFirst()) {
                        int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                        if (!cursor.isNull(sizeIndex)) {
                            size = cursor.getInt(sizeIndex);
                        }
                    }
                    cursor.close();
                }
                if (size > 0) {
                    return true;
                }
            }
        }
        return null;
    }

    private static WritableArray readDir(ArchivesParams param) throws IOException, IllegalAccessException {
        Uri uri = Uri.parse(param.filepath);
        URI_TYPE type = getUriType(uri);
        WritableArray fileMaps = Arguments.createArray();
        // file://path
        if (type == URI_TYPE.FILE) {
            File file = new File(uri.getPath());
            if (!file.exists() || !file.isDirectory()) {
                throw new IOException("Dir does not exist: " + file.getAbsolutePath());
            }
            File[] files = file.listFiles();
            if (null == files) {
                throw new IOException("Read failed, maybe permission denied: " + file.getAbsolutePath());
            }
            for (File name : files) {
                WritableMap fileMap = Arguments.createMap();
                fileMap.putString("name", name.getName());
                fileMap.putString("path", name.getAbsolutePath());
                fileMap.putDouble("size", (double) name.length());
                fileMap.putBoolean("isDir", name.isDirectory());
                fileMap.putDouble("mtime", (double) name.lastModified());
                fileMaps.pushMap(fileMap);
            }
            return fileMaps;
        }
        // content://path
        // todo: 可考虑支持 projection, selection, selectionArgs, sortOrder 等查询条件、添加 增删改 方法
        if (type == URI_TYPE.CONTENT) {
            Cursor cursor = param.context.getContentResolver().query(
                    uri, null, null, null, null
            );
            if(cursor != null){
                int idColumn = cursor.getColumnIndex(BaseColumns._ID);
                while(cursor.moveToNext()){
                    WritableMap fileMap = Arguments.createMap();
                    for (int i=0; i<cursor.getColumnCount(); ++i) {
                        try {
                            fileMap.putString(cursor.getColumnName(i), cursor.getString(i));
                        } catch (Throwable ignored) {
                        }
                    }
                    fileMap.putString("path", idColumn < 0 ? null :
                            ContentUris.withAppendedId(uri, cursor.getLong(idColumn)).toString()
                    );
                    fileMaps.pushMap(fileMap);
                }
                cursor.close();
            }
            return fileMaps;
        }
        // asset://path (文件修改时间使用 package 时间, 下面的 drawable/raw 同)
        // 此处的 AssetManager 不是此处创建的, 不要关闭, 否则会造成意外状况
        String packagePath = param.context.getPackageResourcePath();
        double lastModified = (double) new File(packagePath).lastModified();
        if (type == URI_TYPE.ASSET) {
            String dir = removePathDash(uri.getSchemeSpecificPart());
            AssetManager assetManager = param.context.getAssets();
            String[] list = assetManager.list(dir);
            if (list == null) {
                return fileMaps;
            }
            for (String name: list) {
                int length = 0;
                boolean isDirectory = false;
                String path = dir.isEmpty() ? name : String.format("%s/%s", dir, name);
                try {
                    AssetFileDescriptor assetFileDescriptor = assetManager.openFd(path);
                    length = (int) assetFileDescriptor.getLength();
                    assetFileDescriptor.close();
                } catch (IOException ex) {
                    // 读取失败, 若不是文件夹, 则直接忽略
                    if (assetManager.list(path).length > 0) {
                        isDirectory = true;
                    } else {
                        continue;
                    }
                }
                WritableMap fileMap = Arguments.createMap();
                fileMap.putString("name", name);
                fileMap.putString("path", "asset://" + path);
                fileMap.putInt("size", length);
                fileMap.putBoolean("isDir", isDirectory);
                fileMap.putDouble("mtime", lastModified);
                fileMaps.pushMap(fileMap);
            }
            return fileMaps;
        }
        // raw:// | drawable://  没有子目录, 总是读取根目录
        // 这两种资源最终会保存在 packagePath 这个 zip 压缩包内, 所以还可以通过读取 apk 包的方式获取列表
        // 但速度较慢, 唯一优势是可以获取所有文件 size, 对于压缩过的文件获取到的 size 又不准确, 所以放弃这种方案
        Class<?> cls;
        String scheme = uri.getScheme();
        try {
            cls = Class.forName(param.context.getPackageName() + ".R$" + scheme);
        } catch (ClassNotFoundException ig) {
            return fileMaps;
        }
        Field[] fields = cls.getFields();
        Resources resources = param.context.getResources();
        for (Field field:fields) {
            int length;
            int id = field.getInt(field);
            String name = field.getName();
            try {
                AssetFileDescriptor assetFileDescriptor = resources.openRawResourceFd(id);
                length = (int) assetFileDescriptor.getLength();
                assetFileDescriptor.close();
            } catch (Exception ignored) {
                // 读取 drawable 或 raw 主要是可以下一步 readFile,
                // 所以这里对无法 openRawResourceFd 的文件直接忽略
                continue;
            }
            WritableMap fileMap = Arguments.createMap();
            fileMap.putString("name", name);
            fileMap.putString("path", scheme + "://" + name);
            fileMap.putInt("size", length);
            fileMap.putBoolean("isDir", false);
            fileMap.putDouble("mtime", lastModified);
            fileMaps.pushMap(fileMap);
        }
        return fileMaps;
    }

    private static void rmDir(ArchivesParams param) throws IOException {
        File file = new File(param.filepath);
        if (!file.exists()) {
            return;
        }
        if (!file.isDirectory()) {
            throw new IOException("Path not dir: " + param.filepath);
        }
        removeDirectory(file, param.append);
    }

    @SuppressWarnings("ResultOfMethodCallIgnored")
    private static void readFile(ArchivesParams param) throws IOException {
        InputStream stream = getInputStream(param.context, param.filepath);
        byte[] content;
        if (param.length == null && param.position == null) {
            content = readInputStream(stream);
        } else {
            if (param.position != null) {
                long pos = param.position.longValue();
                if (pos < 0) {
                    pos = Math.max(0, stream.available() + pos);
                }
                stream.skip(pos);
            }
            if (param.length != null) {
                int length = param.length.intValue();
                content = new byte[length];
                stream.read(content, 0, length);
            } else {
                int count;
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                while ((count = stream.read(buffer)) != -1)  {
                    out.write(buffer, 0, count);
                }
                content = out.toByteArray();
            }
            stream.close();
        }
        if ("blob".equals(param.encoding)) {
            BlobModule blob = param.context.getNativeModule(BlobModule.class);
            WritableMap res = Arguments.createMap();
            if (null == blob) {
                throw new IOException("get react native blob module failed");
            }
            res.putString("blobId", blob.store(content));
            res.putInt("offset", 0);
            res.putInt("size", content.length);

            MimeTypeMap map = MimeTypeMap.getSingleton();
            int index = param.filepath.lastIndexOf(".");
            if (index != -1) {
                String suffix = param.filepath.substring(index + 1).toLowerCase();
                String mime = TextUtils.isEmpty(suffix) ? null : map.getMimeTypeFromExtension(suffix);
                if (!TextUtils.isEmpty(mime)) {
                    res.putString("type", mime);
                }
            }
            param.onSuccess(res);
            return;
        }
        String read;
        if ("base64".equals(param.encoding)) {
            read = Base64.encodeToString(content, 0, content.length, Base64.NO_WRAP);
        } else {
            read = new String(content, StandardCharsets.UTF_8);
        }
        param.onSuccess(read);
    }

    private static void writeFile(ArchivesParams param) throws IOException {
        byte[] bytes;
        if ("base64".equals(param.encoding)) {
            bytes = Base64.decode(param.origin, Base64.DEFAULT);
        } else if ("blob".equals(param.encoding)) {
            BlobModule blob = param.context.getNativeModule(BlobModule.class);
            if (null == blob) {
                throw new IOException("get react native blob module failed");
            }
            String[] origin = param.origin.split("#");
            bytes = blob.resolve(origin[0], Integer.parseInt(origin[1]), Integer.parseInt(origin[2]));
        } else {
            bytes = param.origin.getBytes(StandardCharsets.UTF_8);
        }
        if (bytes == null) {
            throw new IOException("write content is empty");
        }
        boolean append = param.append || param.position != null;
        FileOutputStream out = getFileOutputStream(param.context, param.filepath, append);
        if (append) {
            FileChannel outChannel = out.getChannel();
            long pos;
            if (param.append) {
                pos = outChannel.size();
            } else {
                pos = param.position.longValue();
                if (pos < 0) {
                    pos = Math.max(0, outChannel.size() + pos);
                }
            }
            outChannel.position(pos);
            outChannel.write(ByteBuffer.wrap(bytes));
        } else {
            out.write(bytes);
        }
        out.close();
    }

    private static void copyFile(ArchivesParams param) throws IOException {
        makeParent(param.dest, param.append);
        int count;
        InputStream in = getInputStream(param.context, param.source);
        FileOutputStream out = new FileOutputStream(param.dest);
        while ((count = in.read(buffer)) != -1) {
            out.write(buffer, 0, count);
        }
        out.close();
        in.close();
    }

    private static void copyFile(File from, File to, boolean overwrite) throws IOException {
        makeParent(to, overwrite);
        int count;
        InputStream in = new FileInputStream(from);
        FileOutputStream out = new FileOutputStream(to);
        while ((count = in.read(buffer)) != -1) {
            out.write(buffer, 0, count);
        }
        out.close();
        in.close();
    }

    @SuppressWarnings("ResultOfMethodCallIgnored")
    private static void moveFile(ArchivesParams param) throws IOException {
        File from = new File(param.source);
        if (!from.exists() || !from.isFile()) {
            throw new IOException("Source file not exist: " + from.getAbsolutePath());
        }
        makeParent(param.dest, param.append);
        if (!from.renameTo(param.dest)) {
            copyFile(from, param.dest, param.append);
            from.delete();
        }
    }

    private static void mergePatch(ArchivesParams param) throws IOException {
        byte[] patched = ArchivesPatch.getPatchByte(
                readInputStream(getInputStream(param.context, param.origin)),
                readInputStream(getInputStream(param.context, param.source))
        );
        FileOutputStream out = getFileOutputStream(param.context, param.filepath, false);
        out.write(patched);
        out.close();
    }

    // 解压 zip 文件
    private static void unzipFile(ArchivesParams param) throws IOException {
        try (ZipInputStream zis = getZipStream(param)) {
            ZipEntry ze;
            while ((ze = zis.getNextEntry()) != null) {
                String name = ze.getName();
                param.onDebug("unzipping " + name);
                unzipEntry(zis, ze, param.dest, name);
            }
            param.onDebug("unzip finished");
        }
    }

    // 解压一个 相对于 安装包的 patch 增量包
    private static void unzipPatch(ArchivesParams param) throws IOException, JSONException {
        try (ZipInputStream zis = getZipStream(param)) {
            ZipEntry ze;
            HashMap<String, ArrayList<File>> copyList = new HashMap<>();
            while ((ze = zis.getNextEntry()) != null) {
                String name = ze.getName();
                // 整理需要从安装包复制的资源文件
                if (name.equals("__diff.json")) {
                    byte[] bytes = readZipStream(zis);
                    String json = new String(bytes, StandardCharsets.UTF_8);
                    JSONObject obj = (JSONObject) new JSONTokener(json).nextValue();
                    JSONObject copies = obj.getJSONObject("copies");
                    Iterator<?> keys = copies.keys();
                    while (keys.hasNext()) {
                        String to = (String) keys.next();
                        String from = copies.getString(to);
                        if (from.isEmpty()) {
                            from = to;
                        }
                        ArrayList<File> target;
                        if (!copyList.containsKey(from)) {
                            target = new ArrayList<>();
                            copyList.put(from, target);
                        } else {
                            target = copyList.get((from));
                        }
                        if (null == target) {
                            throw new IOException("Get diff.json from patch failed");
                        }
                        target.add(new File(param.dest, to));
                    }
                    continue;
                }
                // 通过 diff 算法合并生成新的 js bundle
                if (name.equals("index.bundlejs.patch")) {
                    byte[] patched = ArchivesPatch.getPatchByte(
                            readOriginBundle(param.context),
                            readZipStream(zis)
                    );
                    FileOutputStream out = new FileOutputStream(new File(param.dest, "index.bundlejs"));
                    out.write(patched);
                    out.close();
                    continue;
                }
                // 复制新的资源文件
                param.onDebug("Unzipping " + name);
                unzipEntry(zis, ze, param.dest, name);
            }
            // 从安装包复制文件
            copyFromResource(param, copyList);
            param.onDebug("Unzip finished");
        }
    }

    // 解压相对于上一个 bundle 的 patch 增量包
    private static void unzipDiff(ArchivesParams param) throws IOException, JSONException {
        File origin = new File(ArchivesContext.getRootDir(), param.origin);
        if (!origin.exists() || !origin.isDirectory()) {
            throw new IOException("Origin directory not exist");
        }
        try (ZipInputStream zis = getZipStream(param)) {
            ZipEntry ze;
            while ((ze = zis.getNextEntry()) != null) {
                String name = ze.getName();

                // 从上一个 bundle 复制资源文件
                if (name.equals("__diff.json")) {
                    byte[] bytes = readZipStream(zis);
                    String json = new String(bytes, StandardCharsets.UTF_8);
                    JSONObject obj = (JSONObject) new JSONTokener(json).nextValue();
                    JSONObject copies = obj.getJSONObject("copies");
                    Iterator<?> keys = copies.keys();
                    while (keys.hasNext()) {
                        String to = (String) keys.next();
                        String from = copies.getString(to);
                        if (from.isEmpty()) {
                            from = to;
                        }
                        copyFile(new File(origin, from), new File(param.dest, to), true);
                    }
                    JSONObject blackList = obj.getJSONObject("deletes");
                    copyFilesWithBlacklist(origin, param.dest, blackList);
                    continue;
                }
                // 通过 diff 算法合并生成新的 js bundle
                if (name.equals("index.bundlejs.patch")) {
                    byte[] patched = ArchivesPatch.getPatchByte(
                            readInputStream(new FileInputStream(new File(origin, "index.bundlejs"))),
                            readZipStream(zis)
                    );
                    FileOutputStream fout = new FileOutputStream(new File(param.dest, "index.bundlejs"));
                    fout.write(patched);
                    fout.close();
                    continue;
                }
                // 复制新的资源文件
                param.onDebug("Unzipping " + name);
                unzipEntry(zis, ze, param.dest, name);
            }
            param.onDebug("Unzip finished");
        }
    }

    // 如果可正常返回,不要关闭 stream, 后续要继续使用; 若有异常,应关闭 stream
    private static ZipInputStream getZipStream(ArchivesParams param) throws IOException {
        InputStream stream = getInputStream(param.context, param.source);
        try {
            if (param.md5 != null) {
                String md5 = getHashFromStream(stream, "MD5", true);
                if (!md5.equals(param.md5)) {
                    throw new IOException("Failed to check source file md5 hash");
                }
            }
            removeDirectory(param.dest);
            if (!param.dest.exists() && !param.dest.mkdirs()) {
                throw new IOException("Failed to ensure directory: " + param.dest.getAbsolutePath());
            }
        } catch (Throwable e){
            stream.close();
            throw e;
        }
        return new ZipInputStream(new BufferedInputStream(stream));
    }

    private static byte[] readZipStream(ZipInputStream zis) throws IOException {
        int count;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        while ((count = zis.read(buffer)) != -1) {
            out.write(buffer, 0, count);
        }
        out.close();
        zis.closeEntry();
        return out.toByteArray();
    }

    // 读取安装包内的 js bundle 文件
    private static byte[] readOriginBundle(Context context) throws IOException {
        InputStream in;
        try {
            in = context.getAssets().open(getBundleAssetName(
                    ((ReactApplication) context.getApplicationContext()).getReactNativeHost()
            ));
        } catch (Throwable e) {
            return new byte[0];
        }
        int count;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        while ((count = in.read(buffer)) != -1) {
            out.write(buffer, 0, count);
        }
        out.close();
        in.close();
        return out.toByteArray();
    }

    private static void copyFromResource(ArchivesParams params, HashMap<String, ArrayList<File>> map) throws IOException {
        try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(new FileInputStream(
                params.context.getPackageResourcePath()
        )))) {
            ZipEntry ze;
            while ((ze = zis.getNextEntry()) != null) {
                String name = ze.getName();
                ArrayList<File> targets = map.get(name);
                if (null == targets) {
                    continue;
                }
                File lastTarget = null;
                for (File target : targets) {
                    params.onDebug("Copying from resource " + name + " to " + target);
                    if (lastTarget != null) {
                        copyFile(lastTarget, target, true);
                    } else {
                        unzipToFile(zis, target);
                        lastTarget = target;
                    }
                }
            }
        }
    }

    private static void copyFilesWithBlacklist(File from, File to, JSONObject blackList) throws IOException {
        copyFilesWithBlacklist("", from, to, blackList);
    }

    // 从 from 目录将 blackList 之外的文件全部复制到 to 目录
    private static void copyFilesWithBlacklist(String current, File from, File to, JSONObject blackList) throws IOException {
        File[] files = from.listFiles();
        if (null == files) {
            throw new IOException("Failed to get file list: " + from.getAbsolutePath());
        }
        for (File file : files) {
            if (file.isDirectory()) {
                String subName = current + file.getName() + '/';
                if (blackList.has(subName)) {
                    continue;
                }
                File toFile = new File(to, file.getName());
                if (!toFile.exists() && !toFile.mkdir()) {
                    throw new IOException("Failed to create directory: " + toFile.getAbsolutePath());
                }
                copyFilesWithBlacklist(subName, file, toFile, blackList);
            } else if (!blackList.has(current + file.getName())) {
                File toFile = new File(to, file.getName());
                if (!toFile.exists()) {
                    copyFile(file, toFile, true);
                }
            }
        }
    }

    // 提取压缩包内单个文件(夹)并保存
    private static void unzipEntry(ZipInputStream zis, ZipEntry ze, File dest, String name) throws IOException{
        File fmd = new File(dest, name);
        // https://developer.android.com/topic/security/risks/zip-path-traversal
        String canonicalPath = fmd.getCanonicalPath();
        if (!canonicalPath.startsWith(dest.getCanonicalPath() + File.separator)) {
            throw new IOException("Illegal name: " + name);
        }
        if (!ze.isDirectory()) {
            unzipToFile(zis, fmd);
        } else if (!fmd.exists() && !fmd.mkdirs()) {
            throw new IOException("Failed to create directory: " + fmd.getAbsolutePath());
        }
    }

    private static void unzipToFile(ZipInputStream zis, File fmd) throws IOException {
        makeParent(fmd, true);
        int count;
        FileOutputStream out = new FileOutputStream(fmd);
        while ((count = zis.read(buffer)) != -1) {
            out.write(buffer, 0, count);
        }
        out.close();
        zis.closeEntry();
    }

    @Override
    protected Void doInBackground(ArchivesParams... params) {
        ArchivesParams param = params[0];
        try {
            boolean noResult = false;
            switch (param.task) {
                case GET_HASH:
                    noResult = true;
                    param.onSuccess(getHash(param));
                    break;
                case IS_DIR:
                    noResult = true;
                    param.onSuccess(isDir(param));
                    break;
                case READ_DIR:
                    noResult = true;
                    param.onSuccess(readDir(param));
                    break;
                case RM_DIR:
                    rmDir(param);
                    break;
                case READ_FILE:
                    noResult = true;
                    readFile(param);
                    break;
                case SAVE_FILE:
                    writeFile(param);
                    break;
                case COPY_FILE:
                    copyFile(param);
                    break;
                case MOVE_FILE:
                    moveFile(param);
                    break;
                case MERGE_PATCH:
                    mergePatch(param);
                    break;
                case UNZIP_FILE:
                    unzipFile(param);
                    break;
                case UNZIP_PATCH:
                    unzipPatch(param);
                    break;
                case UNZIP_DIFF:
                    unzipDiff(param);
                    break;
            }
            if (!noResult) {
                param.onSuccess();
            }
        } catch (Throwable e) {
            param.onFailed(e);
        }
        return null;
    }
}
