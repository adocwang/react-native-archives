LOCAL_PATH := $(call my-dir)

include $(CLEAR_VARS)

LOCAL_MODULE := libhdiff
LOCAL_LDLIBS := -llog

LOCAL_SRC_FILES := \
	hpatch.c \
	hpatch_jni.c \
	../../easypush/lzma/C/LzmaDec.c \
    ../../easypush/lzma/C/Lzma2Dec.c \
    ../../easypush/HDiffPatch/libHDiffPatch/HPatch/patch.c \
	../../easypush/HDiffPatch/file_for_patch.c

include $(BUILD_SHARED_LIBRARY)