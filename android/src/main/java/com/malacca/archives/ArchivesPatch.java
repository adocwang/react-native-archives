package com.malacca.archives;

class ArchivesPatch {
    static {
        System.loadLibrary("bsdiff");
    }
    public static native byte[] patchByte(byte[] origin, byte[] patch);

    public static byte[] getPatchByte(byte[] origin, byte[] patch) {
        return patchByte(origin, patch);
    }
}
