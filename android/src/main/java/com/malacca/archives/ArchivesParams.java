package com.malacca.archives;

import java.io.File;
import android.content.Context;

class ArchivesParams {
    static final int TASK_BS_PATCH = 1;
    static final int TASK_UNZIP_FILE = 2;
    static final int TASK_UNZIP_PATCH = 3;
    static final int TASK_UNZIP_DIFF = 4;

    int     type;
    String  md5;
    Context context;
    String  origin;
    File    source;
    File    dest;

    void onDebug(String debug) {
    }
    void onFailed(Throwable error){
    }
    void onSuccess(){
    }
}
