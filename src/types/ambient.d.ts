declare module 'ali-oss' {
  interface PutResult {
    res: {
      headers: Record<string, string | undefined>;
    };
  }

  interface OSSOptions {
    region: string;
    bucket: string;
    accessKeyId: string;
    accessKeySecret: string;
    stsToken: string;
    secure?: boolean;
  }

  export default class OSS {
    constructor(options: OSSOptions);
    put(name: string, file: Buffer): Promise<PutResult>;
  }
}
