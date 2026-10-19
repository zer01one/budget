package io.github.zer01one.budget

import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import androidx.documentfile.provider.DocumentFile
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter

/**
 * VaultFilePlugin — работает с SAF-деревом (Storage Access Framework).
 *
 * Capacitor's @capawesome/capacitor-file-picker возвращает URI дерева папки
 * (content://com.android.externalstorage.documents/tree/...).
 * Стандартный @capacitor/filesystem не умеет работать с такими URI напрямую.
 * Этот плагин закрывает пробел: readJson, writeJson, listFiles, exists, mkdir.
 *
 * Использование в JS:
 *   import { VaultFilePlugin } from '@/plugins/VaultFilePlugin'
 *   await VaultFilePlugin.writeJson({ treeUri, relativePath, json })
 *   const { json } = await VaultFilePlugin.readJson({ treeUri, relativePath })
 */
@CapacitorPlugin(name = "VaultFile")
class VaultFilePlugin : Plugin() {

    // ── helpers ───────────────────────────────────────────────────────────────

    private fun resolveDocumentFile(treeUri: Uri, relativePath: String): DocumentFile? {
        var dir = DocumentFile.fromTreeUri(context, treeUri) ?: return null
        val segments = relativePath.trimStart('/').split('/')
        // Navigate to parent directories, creating them if needed
        for (i in 0 until segments.size - 1) {
            val segment = segments[i]
            var sub = dir.findFile(segment)
            if (sub == null || !sub.isDirectory) {
                sub = dir.createDirectory(segment) ?: return null
            }
            dir = sub
        }
        return dir.findFile(segments.last())
    }

    private fun resolveOrCreateDocumentFile(treeUri: Uri, relativePath: String, mimeType: String): DocumentFile? {
        var dir = DocumentFile.fromTreeUri(context, treeUri) ?: return null
        val segments = relativePath.trimStart('/').split('/')
        for (i in 0 until segments.size - 1) {
            val segment = segments[i]
            var sub = dir.findFile(segment)
            if (sub == null || !sub.isDirectory) {
                sub = dir.createDirectory(segment) ?: return null
            }
            dir = sub
        }
        val filename = segments.last()
        return dir.findFile(filename) ?: dir.createFile(mimeType, filename)
    }

    // ── plugin methods ────────────────────────────────────────────────────────

    @PluginMethod
    fun readJson(call: PluginCall) {
        val treeUri = Uri.parse(call.getString("treeUri") ?: run {
            call.reject("treeUri required"); return
        })
        val relativePath = call.getString("relativePath") ?: run {
            call.reject("relativePath required"); return
        }
        try {
            val file = resolveDocumentFile(treeUri, relativePath)
            if (file == null || !file.exists()) {
                call.resolve(JSObject().apply { put("exists", false) })
                return
            }
            val uri = file.uri
            val lastModified = file.lastModified()
            val content = context.contentResolver.openInputStream(uri)?.use { stream ->
                BufferedReader(InputStreamReader(stream)).readText()
            } ?: ""
            call.resolve(JSObject().apply {
                put("exists", true)
                put("json", content)
                put("modifiedAt", lastModified)
            })
        } catch (e: Exception) {
            call.reject("readJson failed: ${e.message}")
        }
    }

    @PluginMethod
    fun writeJson(call: PluginCall) {
        val treeUriStr = call.getString("treeUri") ?: run {
            call.reject("treeUri required"); return
        }
        val relativePath = call.getString("relativePath") ?: run {
            call.reject("relativePath required"); return
        }
        val json = call.getString("json") ?: run {
            call.reject("json required"); return
        }
        try {
            val treeUri = Uri.parse(treeUriStr)

            // Re-take persistable permission on every write as a safety measure —
            // some Android versions drop the grant between sessions if not re-affirmed.
            try {
                context.contentResolver.takePersistableUriPermission(
                    treeUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                )
            } catch (_: SecurityException) { /* not currently grantable, proceed */ }

            val root = DocumentFile.fromTreeUri(context, treeUri)
                ?: run { call.reject("fromTreeUri=null uri=$treeUriStr"); return }

            if (!root.canWrite()) {
                call.reject("vault not writable (canWrite=false) uri=$treeUriStr"); return
            }

            val file = resolveOrCreateDocumentFile(treeUri, relativePath, "application/json")
                ?: run {
                    val existing = root.findFile(relativePath.split('/').last())
                    call.reject("createFile=null path=$relativePath existingByName=${existing?.uri}")
                    return
                }

            context.contentResolver.openOutputStream(file.uri, "wt")?.use { stream ->
                OutputStreamWriter(stream).use { it.write(json) }
            } ?: run { call.reject("openOutputStream=null fileUri=${file.uri}"); return }

            call.resolve(JSObject())
        } catch (e: Exception) {
            call.reject("writeJson failed: ${e.message}")
        }
    }

    @PluginMethod
    fun listFiles(call: PluginCall) {
        val treeUri = Uri.parse(call.getString("treeUri") ?: run {
            call.reject("treeUri required"); return
        })
        val relativeDir = call.getString("relativeDir") ?: ""
        try {
            var dir = DocumentFile.fromTreeUri(context, treeUri) ?: run {
                call.reject("Cannot open tree"); return
            }
            if (relativeDir.isNotEmpty()) {
                for (segment in relativeDir.trimStart('/').split('/')) {
                    dir = dir.findFile(segment) ?: run {
                        call.resolve(JSObject().apply { put("files", com.getcapacitor.JSArray()) })
                        return
                    }
                }
            }
            val arr = com.getcapacitor.JSArray()
            dir.listFiles().forEach { arr.put(it.name ?: "") }
            call.resolve(JSObject().apply { put("files", arr) })
        } catch (e: Exception) {
            call.reject("listFiles failed: ${e.message}")
        }
    }

    @PluginMethod
    fun exists(call: PluginCall) {
        val treeUri = Uri.parse(call.getString("treeUri") ?: run {
            call.reject("treeUri required"); return
        })
        val relativePath = call.getString("relativePath") ?: run {
            call.reject("relativePath required"); return
        }
        try {
            val file = resolveDocumentFile(treeUri, relativePath)
            call.resolve(JSObject().apply { put("exists", file != null && file.exists()) })
        } catch (e: Exception) {
            call.reject("exists failed: ${e.message}")
        }
    }

    @PluginMethod
    fun persistPermission(call: PluginCall) {
        val treeUri = Uri.parse(call.getString("treeUri") ?: run {
            call.reject("treeUri required"); return
        })
        try {
            context.contentResolver.takePersistableUriPermission(
                treeUri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
            call.resolve(JSObject())
        } catch (e: SecurityException) {
            call.reject("persistPermission failed: ${e.message}")
        }
    }

    @PluginMethod
    fun mkdir(call: PluginCall) {
        val treeUri = Uri.parse(call.getString("treeUri") ?: run {
            call.reject("treeUri required"); return
        })
        val relativePath = call.getString("relativePath") ?: run {
            call.reject("relativePath required"); return
        }
        try {
            var dir = DocumentFile.fromTreeUri(context, treeUri) ?: run {
                call.reject("Cannot open tree"); return
            }
            for (segment in relativePath.trimStart('/').split('/')) {
                dir = dir.findFile(segment)?.takeIf { it.isDirectory }
                    ?: dir.createDirectory(segment)
                    ?: run { call.reject("Cannot create dir: $segment"); return }
            }
            call.resolve(JSObject())
        } catch (e: Exception) {
            call.reject("mkdir failed: ${e.message}")
        }
    }
}
