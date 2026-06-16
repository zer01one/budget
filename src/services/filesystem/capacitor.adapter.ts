import type { IFileSystemAdapter, FolderPickerResult, FileReadResult } from './IFileSystemAdapter'
import { Preferences } from '@capacitor/preferences'
import { Filesystem, Encoding, Directory } from '@capacitor/filesystem'
import { VaultFile } from '@/plugins/VaultFilePlugin'

const VAULT_URI_KEY = 'vaultUri'
let vaultUri: string | null = null

export function setCapacitorVaultUri(uri: string) {
  vaultUri = uri
}

export function getCapacitorVaultUri(): string | null {
  return vaultUri
}

export class CapacitorAdapter implements IFileSystemAdapter {

  async pickFolder(_opts: { title: string }): Promise<FolderPickerResult> {
    const { FilePicker } = await import('@capawesome/capacitor-file-picker')
    const result = await FilePicker.pickDirectory()
    const uri = result.path ?? ''
    await Preferences.set({ key: VAULT_URI_KEY, value: uri })
    vaultUri = uri
    return { uri, displayPath: uri }
  }

  async readJson<T>(relativePath: string): Promise<FileReadResult<T> | null> {
    if (!vaultUri) throw new Error('Vault URI not set')
    try {
      const result = await VaultFile.readJson({ treeUri: vaultUri, relativePath })
      if (!result.exists || !result.json) return null
      const data = JSON.parse(result.json) as T
      const modifiedAt = result.modifiedAt
        ? new Date(result.modifiedAt).toISOString()
        : new Date().toISOString()
      return { data, modifiedAt }
    } catch {
      return null
    }
  }

  async writeJson<T>(relativePath: string, data: T): Promise<void> {
    if (!vaultUri) throw new Error('Vault URI not set')
    const json = JSON.stringify(data, null, 2)
    await VaultFile.writeJson({ treeUri: vaultUri, relativePath, json })
  }

  async checkVaultAccess(): Promise<boolean> {
    if (!vaultUri) return false
    try {
      const result = await VaultFile.exists({ treeUri: vaultUri, relativePath: 'metadata.json' })
      return result.exists
    } catch {
      return false
    }
  }

  async listFiles(relativeDir: string): Promise<string[]> {
    if (!vaultUri) throw new Error('Vault URI not set')
    try {
      const result = await VaultFile.listFiles({ treeUri: vaultUri, relativeDir })
      return result.files.filter(f => f.endsWith('.json'))
    } catch {
      return []
    }
  }

  async exportFile(filename: string, content: string, _mimeType: string): Promise<void> {
    // Write to app's Downloads/Documents directory
    await Filesystem.writeFile({
      path: filename,
      data: content,
      encoding: Encoding.UTF8,
      directory: Directory.Documents,
    })
  }

  async importFile(_accept: string[]): Promise<{ filename: string; content: string } | null> {
    const { FilePicker } = await import('@capawesome/capacitor-file-picker')
    const result = await FilePicker.pickFiles({ readData: true })
    const file = result.files[0]
    if (!file) return null
    const content = file.data ? atob(file.data) : ''
    return { filename: file.name, content }
  }
}
