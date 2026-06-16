import type { ISOTimestamp } from '@/types'

export interface FolderPickerResult {
  uri: string
  displayPath: string
}

export interface FileReadResult<T> {
  data: T
  modifiedAt: ISOTimestamp
}

export interface IFileSystemAdapter {
  pickFolder(opts: { title: string }): Promise<FolderPickerResult>
  readJson<T>(relativePath: string): Promise<FileReadResult<T> | null>
  writeJson<T>(relativePath: string, data: T): Promise<void>
  checkVaultAccess(): Promise<boolean>
  listFiles(relativeDir: string): Promise<string[]>
  exportFile(filename: string, content: string, mimeType: string): Promise<void>
  importFile(accept: string[]): Promise<{ filename: string; content: string } | null>
}
