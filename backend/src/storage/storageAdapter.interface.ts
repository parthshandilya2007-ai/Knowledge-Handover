export interface SaveFileResult {
  fileRef: string;
  filePath: string;
  size: number;
}

export interface IStorageAdapter {
  saveFile(filename: string, buffer: Buffer, mimetype: string): Promise<SaveFileResult>;
  getFile(fileRef: string): Promise<Buffer>;
  deleteFile(fileRef: string): Promise<void>;
}

