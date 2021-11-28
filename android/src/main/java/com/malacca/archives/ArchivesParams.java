package com.malacca.archives;

import java.io.File;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.ReactApplicationContext;

class ArchivesParams {
    enum TASK {
        GET_HASH,
        IS_DIR,
        READ_DIR,
        RM_DIR,
        READ_FILE,
        SAVE_FILE,
        COPY_FILE,
        MOVE_FILE,
        MERGE_PATCH,
        UNZIP_FILE,
        UNZIP_PATCH,
        UNZIP_DIFF
    }

    TASK task;
    ReactApplicationContext context;

    String filepath;
    String encoding;
    boolean append;
    Double position;
    Double length;

    String  md5;
    String  source;
    String  origin;
    File    dest;

    void onDebug(String debug) {
    }
    void onFailed(Throwable error){
    }
    void onSuccess(){
    }
    void onSuccess(Boolean result){
    }
    void onSuccess(String result){
    }
    void onSuccess(WritableMap result){
    }
    void onSuccess(WritableArray result){
    }
}
