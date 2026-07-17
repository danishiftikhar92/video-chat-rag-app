export interface StoredArtifact {
  path: string;
  relativePath: string;
  publicUrl?: string;
}

export interface StorageProvider {
  saveJson(relativePath: string, value: unknown): Promise<StoredArtifact>;
  saveText(relativePath: string, value: string): Promise<StoredArtifact>;
  saveFile(relativePath: string, content: Buffer): Promise<StoredArtifact>;
  readText(relativePath: string): Promise<string>;
  exists(relativePath: string): Promise<boolean>;
  resolvePath(relativePath: string): string;
  delete(relativePath: string): Promise<void>;
}
