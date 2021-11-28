
declare namespace archives {
  interface BlobPlus extends Blob {
    base64(): Promise<string>;
    dataUrl(): Promise<string>;
    slice(start?: number, end?: number, contentType?: string): BlobPlus;
    close(): void;
    clone(): BlobPlus;
  }

  interface RequestExtend {
    timeout: number;
    resText: boolean;
    saveTo: string;
    keepBlob: boolean;
    onHeader: ((this: XMLHttpRequest, headers: Headers) => any) | null;
    onUpload: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;
    onDownload: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;
  }

  interface RequestInitPlus extends RequestInit, RequestExtend {}

  interface RequestPlus extends Request, RequestExtend {
    clone(): RequestPlus;
  }

  interface ResponsePlus extends Response {
    clone(): ResponsePlus;
  }
  
  interface HttpRequest extends Object {
    init(): object;
    init(key: string): any;
    init(key: string, value:any): this;

    url(): string;
    url(url: string): this;

    method(): string;
    method(method: string): this;

    timeout(): Number;
    timeout(method: Number): this;

    credentials(): string;
    credentials(include: boolean): this;

    referrer(): string;
    referrer(referrer: null|string): this;

    onHeader(): ((this: XMLHttpRequest, headers: Headers) => any) | null;
    onHeader(referrer: ((this: XMLHttpRequest, headers: Headers) => any) | null): this;

    onUpload(): ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;
    onUpload(referrer: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null): this;
    
    onDownload(): ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;
    onDownload(referrer: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null): this;

    signal(): boolean;
    signal(signal: AbortController["signal"]): this;

    resBlob(): boolean;
    resBlob(resBlob: boolean): this;

    saveTo(): string;
    saveTo(path: null|string): this;

    keepBlob(): boolean;
    keepBlob(keep: boolean): this;

    payload(): string;
    payload(body: null|string|object|URLSearchParams|FormData|Blob|ArrayBuffer|DataView): this;
    
    header(): object;
    header(key: string|Array<string>): string|Array<string>|object;
    header(key:string|Array<string>, value:string|Array<string>|null, append?:boolean): this;
    header(headers:object|null, flag?:boolean): this;

    cookie(): object;
    cookie(key: string|Array<string>): string|Array<string>;
    cookie(key:string|Array<string>, value:string|Array<string>|null, append?:boolean): this;
    cookie(cookies:object|null, flag?:boolean): this;

    query(): object;
    query(key: string|Array<string>): string|Array<string>|object;
    query(key:string|Array<string>, value:string|Array<string>|null): this;
    query(queries:object|null, flag?:boolean): this;

    param(): object;
    param(key: string|Array<string>): string|Array<string>|object;
    param(key:string|Array<string>, value:string|Array<string>|null, append?:boolean): this;
    param(params:object|null, flag?:boolean): this;
    
    file(): object;
    file(key: string|Array<string>): string|Array<object>|object;
    file(key:string|Array<string>, value:object|Array<object>|null, append?:boolean): this;
    file(files:object|null, flag?:boolean): this;

    auth(token: string|null): this;
    userAgent(userAgent: string|null): this;
    asAjax(): this;

    send(method: string): Promise<ResponsePlus>;
    json(method: string): Promise<object>;
  }

  interface HttpService extends Object {
    request(
      input: string | Request | RequestInitPlus | RequestPlus,
      init?: RequestInitPlus
    ): HttpRequest;
  }

  interface FileItem extends Object{
    name: string,
    path: string,
    size: number,
    isDir: boolean,
  }

  interface OpenFileOptions {
    ext?: string,
    title?: string,
    onClose?: (() => any) | null,
  }

  type networkType_ = 1 | 2 | 3;
  interface AndroidDownloadOptions {
    url: string,
    mime?: string,
    dest?: string,
    title?: string,
    description?: string,
    scannable?: boolean,
    roaming?: boolean,
    quiet?: boolean,
    network?: networkType_,
    headers?: object,
    onProgress?: ((total:Number, loaded:Number, percent:Number) => any) | null,
    onComplete?: ((file:string, url:string, mime:string, size:Number, mtime:Number) => any) | null,
    onAutoOpen?: ((result:null|Error) => any) | null,
    onError?: ((result:Error) => any) | null,
  }

  interface NoticeOptions {
    file: string,
    mime?: string,
    title?: string,
    description?: string,
    quiet?: boolean,
  }

  type encoding_ = 'text' | 'blob' | 'base64' | 'buffer' | 'uri';
  type algorithm_ = 'md5' | 'sha1' | 'sha224' | 'sha256' | 'sha384' | 'sha512';
}

declare const archives: {
  BlobPlus: {
    new (blobParts?: Array<Blob | string>, options?: BlobOptions): archives.BlobPlus;
    prototype: archives.BlobPlus;
  };

  RequestPlus: {
    new (
      input: string | Request | archives.RequestInitPlus | archives.RequestPlus,
      init?: archives.RequestInitPlus
    ): archives.RequestPlus;
    prototype: archives.RequestPlus;
  };

  ResponsePlus: {
    new (body?: BodyInit_, init?: ResponseInit): archives.ResponsePlus;
    prototype: archives.ResponsePlus;
  };

  fetchPlus(
    input: string | Request | archives.RequestInitPlus | archives.RequestPlus,
    init?: archives.RequestInitPlus
  ): Promise<archives.ResponsePlus>;

  HttpService: {
    new (baseUrl: string): archives.HttpService;
    prototype: archives.HttpService;
  };

  dirs: {
    MainBundle: string;
    Document: string;
    Library: string;
    Caches: string;
    Temporary: string;
  },

  external?: {
    AppCaches: string;
    AppDocument: string;
    Root: string;
    Music: string;
    Picture: string;
    DCIM: string;
    Movie: string;
    Download: string;
    Podcasts: string;
    Ringtones: string;
    Alarms: string;
    Notifications: string;
  },

  status: {
    downloadRootDir: string;
    packageVersion: string;
    currentVersion: string;
    isFirstTime: string;
    isRolledBack: string;
  },

  utils:{
    arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferView): string;
    base64ToArrayBuffer(base64: string): ArrayBuffer;
    arrayBufferToText(buffer: ArrayBufferLike): string;
    textToArrayBuffer(str: string): ArrayBuffer;
    getNumber(v: number, def: any): number;
    normalizeMethod(method: string): string;
    ltrim(str: string, char?:string): string;
    rtrim(str: string, char?:string): string;
    parseQuery(rawQuery: string): object;
    parseCookie(rawCookie: string): object;
    parseHeader(rawHeader: string): Headers;
    makeCookie(obj: object): string;
    makeQuery(obj: object): string;
    makeParam(obj: object, strify?:boolean): string;
    makeUrl(baseUrl: string, path?:string, queries?:string): string;
    readBlob(blob: Blob, encoding?: archives.encoding_): Promise<string|ArrayBuffer>;
  },
  
  fs:{
    isDir(path: string): Promise<boolean | null>;
    mkDir(path: string, recursive?: boolean): Promise<null>;
    rmDir(path: string, recursive?: boolean): Promise<null>;
    readDir(path: string): Promise<archives.FileItem | object>;

    writeFile(
      file: string,
      content: string|Blob|ArrayBuffer|Array<string>,
      flag?:null|true|number
    ): Promise<null>;

    readFile(
      path: string,
      encoding?: archives.encoding_,
      offset?: number,
      length?: number
    ): Promise<archives.BlobPlus | ArrayBuffer | string>;

    copyFile(source: string, dest: string, overwrite?: boolean): Promise<null>;
    moveFile(source: string, dest: string, overwrite?: boolean): Promise<null>;
    unlink(file: string): Promise<null>;

    openFile(file: string, options?: archives.OpenFileOptions): Promise<null>;
    getMime(file: string | Array<string>): Promise<string | Array<string>>;
    getHash(file: string, algorithm?: archives.algorithm_): Promise<string>;
    loadFont(fontName: string, file: string): Promise<null>;

    mergePatch(source:string, patch:string, dest:string): Promise<null>;
    unzip(file: string, dir: string, md5?: string): Promise<null>;
    unzipBundle(file:string, md5:string): Promise<null>;
    unzipPatch(file:string, md5Version:string, patchMd5?:string): Promise<null>;
    unzipDiff(file:string, md5Version:string, originVersion:string, patchMd5?:string): Promise<null>;
    switchVersion(md5Version:string, reload?:boolean): Promise<null>;
    markSuccess(): Promise<null>;
    reload(): Promise<null>;

    getShareUri(file: string): Promise<string>;
    getContentUri(mediaType?: string, type?: string): Promise<string>;
    download(options: archives.AndroidDownloadOptions): Promise<null>;
    addDownload(options: archives.NoticeOptions): Promise<string>;
    restartAndroid(): Promise<null>;
  },
};

export = archives;