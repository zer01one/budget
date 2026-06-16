import type { IFileSystemAdapter, FolderPickerResult, FileReadResult } from './IFileSystemAdapter'

let vaultPath: string | null = null

export function setTauriVaultPath(path: string) {
  vaultPath = path
}

export function getTauriVaultPath(): string | null {
  return vaultPath
}

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/')
}

export class TauriAdapter implements IFileSystemAdapter {
  async pickFolder(opts: { title: string }): Promise<FolderPickerResult> {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, multiple: false, title: opts.title })
    if (!selected || typeof selected !== 'string') {
      throw new Error('No folder selected')
    }
    return { uri: selected, displayPath: selected }
  }

  async readJson<T>(relativePath: string): Promise<FileReadResult<T> | null> {
    if (!vaultPath) throw new Error('Vault path not set')
    const { readTextFile, stat } = await import('@tauri-apps/plugin-fs')
    const fullPath = joinPath(vaultPath, relativePath)
    try {
      const [content, fileStat] = await Promise.all([
        readTextFile(fullPath),
        stat(fullPath),
      ])
      const data = JSON.parse(content) as T
      const modifiedAt = new Date(fileStat.mtime ?? Date.now()).toISOString()
      return { data, modifiedAt }
    } catch {
      return null
    }
  }

  async writeJson<T>(relativePath: string, data: T): Promise<void> {
    if (!vaultPath) throw new Error('Vault path not set')
    const { writeTextFile, rename, mkdir, exists } = await import('@tauri-apps/plugin-fs')
    const fullPath = joinPath(vaultPath, relativePath)
    const tmpPath = fullPath + '.tmp'

    // Ensure parent directory exists
    const parentDir = fullPath.substring(0, fullPath.lastIndexOf('/'))
    const parentExists = await exists(parentDir)
    if (!parentExists) {
      await mkdir(parentDir, { recursive: true })
    }

    const content = JSON.stringify(data, null, 2)
    await writeTextFile(tmpPath, content)
    await rename(tmpPath, fullPath)
  }

  async checkVaultAccess(): Promise<boolean> {
    if (!vaultPath) return false
    const { exists } = await import('@tauri-apps/plugin-fs')
    return exists(vaultPath)
  }

  async listFiles(relativeDir: string): Promise<string[]> {
    if (!vaultPath) throw new Error('Vault path not set')
    const { readDir } = await import('@tauri-apps/plugin-fs')
    const fullDir = joinPath(vaultPath, relativeDir)
    try {
      const entries = await readDir(fullDir)
      return entries
        .filter(e => !e.isDirectory && e.name?.endsWith('.json'))
        .map(e => e.name ?? '')
        .filter(Boolean)
    } catch {
      return []
    }
  }

  async exportFile(filename: string, content: string, _mimeType: string): Promise<void> {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const savePath = await save({ defaultPath: filename })
    if (savePath) {
      await writeTextFile(savePath, content)
    }
  }

  async importFile(accept: string[]): Promise<{ filename: string; content: string } | null> {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Files', extensions: accept.map(a => a.replace('.', '')) }],
    })
    if (!selected || typeof selected !== 'string') return null
    const content = await readTextFile(selected)
    const filename = selected.split('/').pop() ?? selected.split('\\').pop() ?? 'file'
    return { filename, content }
  }
}
