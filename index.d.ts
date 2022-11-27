
declare namespace types {
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

    timeout(): number;
    timeout(method: number): this;

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

    bag(): object;
    bag(key: string|Array<string>): string|Array<string>|object;
    bag(key:string|Array<string>, value:string|Array<string>|null): this;
    bag(bags:object|null, flag?:boolean): this;

    auth(token: string|null): this;
    userAgent(userAgent: string|null): this;
    asAjax(): this;

    skipOnRequest(skip: Boolean|undefined): this;
    skipOnResponse(skip: Boolean|undefined): this;

    send(method: string): Promise<ResponsePlus>;
    json(method: string): Promise<object>;
    clone(): HttpRequest;
  }

  interface HttpService extends Object {
    request(
      input: string | Request | RequestInitPlus | RequestPlus,
      init?: RequestInitPlus
    ): HttpRequest;
    onRequest(req:HttpRequest): Promise<HttpRequest>;
    onResponse(res:ResponsePlus, req:HttpRequest): Promise<ResponsePlus>;
  }

  interface OpenFileOptions {
    mime?: string,
    title?: string,
    onClose?: (() => any) | null,
  }

  interface CameraRollOptions {
    album?: string,
    type?: 'photo' | 'video' | 'auto',
  }

  interface FileItem extends Object{
    name: string,
    path: string,
    size: number,
    isDir: boolean,
  }

  interface AndroidIntentExtra {
    key: string,
    value: string|number|Array<string|number>,
    type?: 'string' | 'int' | 'uri',
  }

  interface AndroidIntentOptions {
    action: string,
    data?: string,
    type?: string,
    categories?: Array<string>,
    package?: string,
    component?: string,
    identifier?: string,
    extras?: Array<AndroidIntentExtra>,
  }

  interface AndroidDownloadOptions {
    url: string,
    mime?: string,
    dest?: string,
    title?: string,
    description?: string,
    scannable?: boolean,
    roaming?: boolean,
    quiet?: boolean,
    network?: 1|2|3,
    headers?: object,
    onError?: ((result:Error) => any) | null,
    onProgress?: ((total:number, loaded:number, percent:number) => any) | null,
    onComplete?: ((file:string, url:string, mime:string, size:number, mtime:number) => any) | null,
  }

  interface AndroidDownloadNotice {
    file: string,
    mime?: string,
    title?: string,
    description?: string,
    quiet?: boolean,
  }

  type _encoding =  'buffer' | 'text' | 'base64' | 'uri';
  type _fileEncoding = 'blob' | _encoding;
  type _algorithm = 'md5' | 'sha1' | 'sha224' | 'sha256' | 'sha384' | 'sha512';
  type _mediaType = 'images' | 'video' | 'audio' | 'files' | 'downloads' |
    'audio.artists' | 'audio.artists' | 'audio.albums' | 'audio.genres' | 'audio.playlists';
  type _mediaVolume = 'external' | 'internal';
}

declare const archives: {
  BlobPlus: {
    new (blobParts?: Array<Blob | string>, options?: BlobOptions): types.BlobPlus;
    prototype: types.BlobPlus;
  };

  RequestPlus: {
    new (
      input: string | Request | types.RequestInitPlus | types.RequestPlus,
      init?: types.RequestInitPlus
    ): types.RequestPlus;
    prototype: types.RequestPlus;
  };

  ResponsePlus: {
    new (body?: BodyInit_, init?: ResponseInit): types.ResponsePlus;
    prototype: types.ResponsePlus;
  };

  fetchPlus(
    input: string | Request | types.RequestInitPlus | types.RequestPlus,
    init?: types.RequestInitPlus
  ): Promise<types.ResponsePlus>;

  HttpService: {
    new (baseUrl: string): types.HttpService;
    prototype: types.HttpService;
  };

  dirs: {
    MainBundle: string;
    Root: string;
    Document: string;
    Library: string;
    Caches: string;
    Temporary: string;
  },

  external?: {
    AppRoot: string;
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
    packageName: string;
    packageVersion: string;
    currentVersion: string;
    isFirstTime: boolean;
    rolledVersion: string;
  },

  fs:{
    // Common
    isDir(path: string): Promise<boolean | null>;
    mkDir(path: string, recursive?: boolean): Promise<null>;
    rmDir(path: string, recursive?: boolean): Promise<null>;
    readDir(path: string): Promise<Array<types.FileItem | object>>;

    writeFile(
      file: string,
      content: string|Blob|ArrayBuffer|Array<string>,
      flag?: true|number|null
    ): Promise<null>;

    readFile(
      path: string,
      encoding?: types._fileEncoding,
      offset?: number,
      length?: number
    ): Promise<string | types.BlobPlus | ArrayBuffer>;

    copyFile(source: string, dest: string, overwrite?: boolean): Promise<null>;
    moveFile(source: string, dest: string, overwrite?: boolean): Promise<null>;
    unlink(file: string): Promise<null>;

    openFile(file: string, options?: types.OpenFileOptions): Promise<null>;
    getMime(file: string | Array<string>): Promise<string | Array<string>>;
    getExt(mime: string | Array<string>): Promise<string | Array<string>>;
    getHash(file: string, algorithm?: types._algorithm): Promise<string>;
    loadFont(fontName: string, file: string): Promise<null>;
    reload(): Promise<null>;
    unzip(file: string, dir: string, md5?: string): Promise<null>;

    mergePatch(source:string, patch:string, dest:string): Promise<null>;
    unzipBundle(bundle:string, md5:string): Promise<null>;
    unzipPatch(patch:string, md5Version:string, patchMd5?:string): Promise<null>;
    unzipDiff(patch:string, md5Version:string, patchMd5?:string): Promise<null>;
    switchVersion(md5Version:string, reload?:boolean): Promise<null>;
    markSuccess(): Promise<null>;
    reinitialize(reload?:boolean): Promise<null>;

    // iOS
    saveToCameraRoll(file: string, options:types.CameraRollOptions): Promise<string>;

    // Android
    scanFile(file: string): Promise<string>;
    isExternalManager(): Promise<boolean>;
    requestExternalManager(): Promise<null>;
    getShareUri(file: string): Promise<string>;
    getContentUri(mediaType?: types._mediaType, type?: types._mediaVolume): Promise<string>;
    sendIntent(options: types.AndroidIntentOptions): Promise<null>;
    download(options: types.AndroidDownloadOptions): Promise<null>;
    addDownload(options: types.AndroidDownloadNotice): Promise<string>;
    restartAndroid(): Promise<null>;
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
    makeUrl(baseUrl: string, path?:string, queries?:object): string;
    readBlob(blob: Blob, encoding?: types._encoding): Promise<string|ArrayBuffer>;
  },
};

export = archives;