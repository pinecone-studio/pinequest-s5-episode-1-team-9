export type StoredObject = {
  key: string;
  url: string;
  contentType: string;
  size: number;
};

export interface StorageAdapter {
  put(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<StoredObject>;
  getUrl(key: string): string;
}
