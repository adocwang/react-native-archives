package com.malacca.archives;

import org.json.JSONObject;
import org.json.JSONTokener;
import org.json.JSONException;

import java.util.HashMap;
import java.util.Iterator;
import java.util.ArrayList;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;

import java.nio.charset.Charset;
import java.security.MessageDigest;

import android.os.AsyncTask;
import android.content.Context;

/**
 * Created by tdzl2003 on 3/31/16.
 * https://git.io/JeAjO
 * 做了一些变动, 移除了下载相关的代码, 仅保留了解压热更包等相关代码
 * 所以并不是很通用, 更像是一个工具包, 需自行借助 rn-fs 之类的模块 组合使用
 */
class ArchivesManager extends AsyncTask<ArchivesParams, Void, Void> {
    static {
        System.loadLibrary("bsdiff");
    }
    private static final byte[] buffer = new byte[1024];
    public static native byte[] patchByte(byte[] origin, byte[] patch);

    static void removeDirectory(File file) throws IOException {
        if (file.isDirectory()) {
            File[] files = file.listFiles();
            for (File f : files) {
                String name = f.getName();
                if (name.equals(".") || name.equals("..")) {
                    continue;
                }
                removeDirectory(f);
            }
        }
        if (file.exists() && !file.delete()) {
            throw new IOException("Failed to delete directory");
        }
    }

    private static byte[] readFile(File file) throws IOException {
        int count;
        InputStream in = new FileInputStream(file);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        while ((count = in.read(buffer)) != -1)  {
            out.write(buffer, 0, count);
        }
        out.close();
        in.close();
        return out.toByteArray();
    }

    private static void copyFile(File from, File to) throws IOException {
        int count;
        InputStream in = new FileInputStream(from);
        FileOutputStream out = new FileOutputStream(to);
        while ((count = in.read(buffer)) != -1) {
            out.write(buffer, 0, count);
        }
        out.close();
        in.close();
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

    private static void unzipToFile(ZipInputStream zis, File fmd) throws IOException {
        int count;
        FileOutputStream out = new FileOutputStream(fmd);
        while ((count = zis.read(buffer)) != -1) {
            out.write(buffer, 0, count);
        }
        out.close();
        zis.closeEntry();
    }

    private static byte[] readOriginBundle(Context context) throws IOException {
        InputStream in;
        try {
            in = context.getAssets().open("index.android.bundle");
        } catch (Exception e) {
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
        ZipEntry ze;
        ZipInputStream zis = new ZipInputStream(new BufferedInputStream(new FileInputStream(
                params.context.getPackageResourcePath()
        )));
        while ((ze = zis.getNextEntry()) != null) {
            String fn = ze.getName();
            ArrayList<File> targets = map.get(fn);
            if (targets != null) {
                File lastTarget = null;
                for (File target: targets) {
                    params.onDebug("Copying from resource " + fn + " to " + target);
                    if (lastTarget != null) {
                        copyFile(lastTarget, target);
                    } else {
                        unzipToFile(zis, target);
                        lastTarget = target;
                    }
                }
            }
        }
    }

    private static void copyFilesWithBlacklist(String current, File from, File to, JSONObject blackList) throws IOException {
        File[] files = from.listFiles();
        for (File file : files) {
            if (file.isDirectory()) {
                String subName = current + file.getName() + '/';
                if (blackList.has(subName)) {
                    continue;
                }
                File toFile = new File(to, file.getName());
                if (!toFile.exists() && !toFile.mkdir()) {
                    throw new IOException("Failed to create directory");
                }
                copyFilesWithBlacklist(subName, file, toFile, blackList);
            } else if (!blackList.has(current + file.getName())) {
                File toFile = new File(to, file.getName());
                if (!toFile.exists()) {
                    copyFile(file, toFile);
                }
            }
        }
    }

    private static void copyFilesWithBlacklist(File from, File to, JSONObject blackList) throws IOException {
        copyFilesWithBlacklist("", from, to, blackList);
    }

    private static void bsPatchFile(ArchivesParams param) throws IOException {
        if (!param.source.exists() || !param.source.isFile()) {
            throw new IOException("Source file not exist");
        }
        File origin = new File(param.origin);
        if (!origin.exists() || !origin.isFile()) {
            throw new IOException("Origin file not exist");
        }
        byte[] patched = patchByte(readFile(origin), readFile(param.source));
        FileOutputStream out = new FileOutputStream(param.dest);
        out.write(patched);
        out.close();
    }

    private static ZipInputStream getZipStream(ArchivesParams param) throws IOException {
        if (!param.source.exists() || !param.source.isFile()) {
            throw new IOException("Source file not exist");
        }
        FileInputStream stream;
        if (param.md5 != null) {
            MessageDigest digest;
            try {
                digest = MessageDigest.getInstance("MD5");
            } catch (Exception e) {
                throw new IOException("Failed to getting md5 digest");
            }
            int count;
            stream = new FileInputStream(param.source);
            while ((count = stream.read(buffer)) != -1) {
                digest.update(buffer, 0, count);
            }
            byte[] md5Bytes = digest.digest();
            if (md5Bytes.length <= 0) {
                stream.close();
                throw new IOException("Failed to getting source md5 hash");
            }
            StringBuilder stringBuilder = new StringBuilder("");
            for (byte md5Byte : md5Bytes) {
                int v = md5Byte & 0xFF;
                String hv = Integer.toHexString(v);
                if (hv.length() < 2) {
                    stringBuilder.append(0);
                }
                stringBuilder.append(hv);
            }
            String md5 = stringBuilder.toString();
            if (!md5.equals(param.md5)) {
                stream.close();
                throw new IOException("Failed to check source file md5 hash");
            } else {
                stream.getChannel().position(0);
            }
        } else {
            stream = new FileInputStream(param.source);
        }
        removeDirectory(param.dest);
        if (!param.dest.mkdirs()) {
            throw new IOException("Failed to create directory");
        }
        return new ZipInputStream(new BufferedInputStream(stream));
    }

    private static void unzipFile(ArchivesParams param) throws IOException {
        ZipInputStream zis = getZipStream(param);
        ZipEntry ze;
        while ((ze = zis.getNextEntry()) != null) {
            String fn = ze.getName();
            File fmd = new File(param.dest, fn);
            param.onDebug("unzipping " + fn);
            if (!ze.isDirectory()) {
                unzipToFile(zis, fmd);
            } else if (!fmd.mkdirs()) {
                throw new IOException("Failed to create directory");
            }
        }
        zis.close();
        param.onDebug("unzip finished");
    }

    private static void unzipPatch(ArchivesParams param) throws IOException, JSONException {
        ZipInputStream zis = getZipStream(param);
        ZipEntry ze;
        HashMap<String, ArrayList<File>> copyList = new HashMap<>();
        while ((ze = zis.getNextEntry()) != null) {
            String fn = ze.getName();

            // copy files from assets
            if (fn.equals("__diff.json")) {
                byte[] bytes = readZipStream(zis);
                String json = new String(bytes, Charset.forName("UTF-8"));
                JSONObject obj = (JSONObject)new JSONTokener(json).nextValue();

                JSONObject copies = obj.getJSONObject("copies");
                Iterator<?> keys = copies.keys();
                while( keys.hasNext() ) {
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
                    assert target != null;
                    target.add(new File(param.dest, to));
                }
                continue;
            }

            // do bsdiff patch
            if (fn.equals("index.bundlejs.patch")) {
                byte[] patched = patchByte(readOriginBundle(param.context), readZipStream(zis));
                FileOutputStream out = new FileOutputStream(new File(param.dest, "index.bundlejs"));
                out.write(patched);
                out.close();
                continue;
            }

            param.onDebug("Unzipping " + fn);
            File fmd = new File(param.dest, fn);
            if (!ze.isDirectory()) {
                unzipToFile(zis, fmd);
            } else if (!fmd.mkdirs()) {
                throw new IOException("Failed to create directory");
            }
        }
        zis.close();
        copyFromResource(param, copyList);
        param.onDebug("Unzip finished");
    }

    private static void unzipDiff(ArchivesParams param) throws IOException, JSONException {
        ZipInputStream zis = getZipStream(param);
        File origin = new File(ArchivesContext.getRootDir(), param.origin);
        if (!origin.exists() || !origin.isDirectory()) {
            throw new IOException("Origin directory not exist");
        }
        ZipEntry ze;
        while ((ze = zis.getNextEntry()) != null) {
            String fn = ze.getName();

            // copy files from assets
            if (fn.equals("__diff.json")) {
                byte[] bytes = readZipStream(zis);
                String json = new String(bytes, Charset.forName("UTF-8"));
                JSONObject obj = (JSONObject)new JSONTokener(json).nextValue();

                JSONObject copies = obj.getJSONObject("copies");
                Iterator<?> keys = copies.keys();
                while( keys.hasNext() ) {
                    String to = (String) keys.next();
                    String from = copies.getString(to);
                    if (from.isEmpty()) {
                        from = to;
                    }
                    copyFile(new File(origin, from), new File(param.dest, to));
                }
                JSONObject blackList = obj.getJSONObject("deletes");
                copyFilesWithBlacklist(origin, param.dest, blackList);
                continue;
            }

            // do bsdiff patch
            if (fn.equals("index.bundlejs.patch")) {
                byte[] patched = patchByte(readFile(new File(origin, "index.bundlejs")), readZipStream(zis));
                FileOutputStream fout = new FileOutputStream(new File(param.dest, "index.bundlejs"));
                fout.write(patched);
                fout.close();
                continue;
            }

            param.onDebug("Unzipping " + fn);
            File fmd = new File(param.dest, fn);
            if (!ze.isDirectory()) {
                unzipToFile(zis, fmd);
            } else if (!fmd.mkdirs()) {
                throw new IOException("Failed to create directory");
            }
        }
        zis.close();
        param.onDebug("Unzip finished");
    }

    @Override
    protected Void doInBackground(ArchivesParams... params) {
        ArchivesParams param = params[0];
        try {
            switch (param.type) {
                case ArchivesParams.TASK_BS_PATCH:
                    bsPatchFile(param);
                    break;
                case ArchivesParams.TASK_UNZIP_FILE:
                    unzipFile(param);
                    break;
                case ArchivesParams.TASK_UNZIP_PATCH:
                    unzipPatch(param);
                    break;
                case ArchivesParams.TASK_UNZIP_DIFF:
                    unzipDiff(param);
                    break;
            }
            param.onSuccess();
        } catch (Throwable e) {
            param.onFailed(e);
        }
        return null;
    }
}
