package com.previewjs.intellij.plugin.services

import com.intellij.codeInsight.hints.InlayHintsPassFactory
import com.intellij.execution.filters.TextConsoleBuilderFactory
import com.intellij.execution.ui.ConsoleView
import com.intellij.execution.ui.ConsoleViewContentType
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.FileEditorManagerListener
import com.intellij.openapi.fileEditor.TextEditor
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowAnchor
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.WindowManager
import com.intellij.openapi.wm.ex.ToolWindowManagerListener
import com.intellij.psi.PsiFile
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import com.previewjs.intellij.plugin.api.CrawlFileRequest
import com.previewjs.intellij.plugin.api.Previewable
import com.previewjs.intellij.plugin.api.StartPreviewRequest
import com.previewjs.intellij.plugin.api.StopPreviewRequest
import com.previewjs.intellij.plugin.api.UpdatePendingFileRequest
import com.previewjs.intellij.plugin.statusbar.OpenMenuStatusBarWidget
import org.apache.commons.lang.StringUtils
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import java.net.URLEncoder
import kotlin.math.max

@Service(Service.Level.PROJECT)
class ProjectService(private val project: Project) : Disposable {
    companion object {
        private const val TOOL_WINDOW_ID = "Preview.js"
        private val JS_EXTENSIONS = setOf("js", "jsx", "ts", "tsx", "svelte", "vue")
        private val LIVE_UPDATING_EXTENSIONS =
            JS_EXTENSIONS + setOf("css", "sass", "scss", "less", "styl", "stylus", "svg")
    }

    private val app = ApplicationManager.getApplication()
    private val statusBar = WindowManager.getInstance().getStatusBar(project)
    private val smallLogo = IconLoader.getIcon("/logo.svg", javaClass)
    private val service = app.getService(PreviewJsSharedService::class.java)
    private var consoleView: ConsoleView? = null
    private var consoleToolWindow: ToolWindow? = null
    private var previewBrowser: JBCefBrowser? = null
    private var previewToolWindow: ToolWindow? = null
    private var previewToolWindowActive = false

    @Volatile
    private var currentPreviewWorkspaceId: String? = null
    private var componentMap = mutableMapOf<String, Pair<String, List<Previewable>>>()
    private var pendingFileChanges = mutableMapOf<String, String>()

    init {
        val connection = project.messageBus.connect(this)

        EditorFactory.getInstance().eventMulticaster.addDocumentListener(
            object : DocumentListener {
                override fun documentChanged(event: DocumentEvent) {
                    val file = FileDocumentManager.getInstance().getFile(event.document) ?: return
                    updateFileContent(file, event.document.text)
                }
            },
            this
        )

        connection.subscribe(
            VirtualFileManager.VFS_CHANGES,
            object : BulkFileListener {
                override fun after(events: List<VFileEvent>) {
                    events.forEach { event ->
                        val file = event.file ?: return@forEach
                        updateFileContent(file, null)
                    }
                }
            }
        )

        // Keep track of whether preview panel is active or not.
        connection.subscribe(
            ToolWindowManagerListener.TOPIC,
            object : ToolWindowManagerListener {
                override fun stateChanged(toolWindowManager: ToolWindowManager) {
                    val toolWindow = toolWindowManager.getToolWindow(TOOL_WINDOW_ID) ?: return
                    // Note: stateChanged may be called about any other tool window, so double check
                    // there was a change.
                    if (toolWindow.isActive != previewToolWindowActive) {
                        previewToolWindowActive = toolWindow.isActive
                        if (previewToolWindowActive) {
                            for ((path, text) in pendingFileChanges) {
                                uploadFileContentToPreviewJsApi(path, text)
                            }
                            pendingFileChanges.clear()
                        }
                    }
                }
            }
        )

        // Keep track of all open files to track their components.
        //
        // This is required because inlay providers must do their work synchronously. An earlier version
        // of Preview.js made a blocking call to the Preview.js server that introduced overall slowness
        // in the IDE as this all happens on the main thread(!).
        connection.subscribe(
            FileEditorManagerListener.FILE_EDITOR_MANAGER,
            object : FileEditorManagerListener {
                override fun fileOpened(source: FileEditorManager, file: VirtualFile) {
                    val textEditor = source.allEditors.find { it.file == file } as? TextEditor ?: return
                    if (textEditor.file != file) {
                        return
                    }
                    recrawlFile(file, textEditor.editor.document.text)
                }

                override fun fileClosed(source: FileEditorManager, file: VirtualFile) {
                    onFileClosed(file)
                }
            }
        )
        FileEditorManager.getInstance(project).allEditors.forEach { textEditor ->
            if (textEditor !is TextEditor) {
                return@forEach
            }
            recrawlFile(textEditor.file, textEditor.editor.document.text)
        }
    }

    private fun updateFileContent(file: VirtualFile, text: String?) {
        if (file.extension == null || !LIVE_UPDATING_EXTENSIONS.contains(file.extension) || !file.isInLocalFileSystem || !file.isWritable || (text != null && text.length > 1_048_576)) {
            return
        }
        if (previewToolWindowActive) {
            uploadFileContentToPreviewJsApi(file.path, text)
        } else {
            // Don't make unnecessary HTTP requests to Preview.js API, keep them for
            // when the preview panel is active.
            if (text != null) {
                pendingFileChanges[file.path] = text
            } else {
                pendingFileChanges.remove(file.path)
            }
        }
    }

    private fun uploadFileContentToPreviewJsApi(path: String, text: String?) {
        service.enqueueAction(project, { api ->
            api.updatePendingFile(
                UpdatePendingFileRequest(
                    absoluteFilePath = path,
                    utf8Content = text
                )
            )
        }, {
            "Warning: unable to update pending file $path"
        })
    }

    fun printToConsole(text: String) {
        app.invokeLater {
            if (project.isDisposed) {
                return@invokeLater
            }
            getOrCreateConsole().print(text, ConsoleViewContentType.NORMAL_OUTPUT)
        }
    }

    private fun getOrCreateConsole(): ConsoleView {
        val existingConsoleView = consoleView
        if (existingConsoleView !== null) {
            return existingConsoleView
        }
        val consoleView = TextConsoleBuilderFactory.getInstance().createBuilder(project).console
        Disposer.register(this, consoleView)
        this.consoleView = consoleView
        this.consoleToolWindow = ToolWindowManager.getInstance(project).registerToolWindow(
            "Preview.js logs"
        ) {
            anchor = ToolWindowAnchor.BOTTOM
            icon = smallLogo
            canCloseContent = false
        }.apply {
            contentManager.addContent(
                ContentFactory.getInstance().createContent(
                    consoleView.component,
                    null,
                    false
                )
            )
        }
        return consoleView
    }

    private fun recrawlFile(file: VirtualFile, text: String) {
        crawlFile(file) { components ->
            componentMap[file.path] = Pair(text, components)
            @Suppress("UnstableApiUsage")
            app.invokeLater {
                InlayHintsPassFactory.forceHintsUpdateOnNextPass()
            }
        }
    }

    private fun onFileClosed(file: VirtualFile) {
        componentMap.remove(file.path)
    }

    fun getPrecomputedComponents(psiFile: PsiFile): List<Previewable> {
        val currentText = psiFile.text
        val computed = componentMap[psiFile.virtualFile.path] ?: return emptyList()
        val (computedText, components) = computed
        if (currentText == computedText) {
            return components
        }

        // Since it's not an exact match, trigger recomputing in the background.
        recrawlFile(psiFile.virtualFile, currentText)

        // Keep going to see if we can show something useful in the meantime to avoid unnecessary flickering.
        // If a chunk of text was either added or removed, then we can still show our old results by shifting
        // them a little.
        val exactCharacterDifferenceIndex = StringUtils.indexOfDifference(currentText, computedText)
        val differenceDelta = currentText.length - computedText.length
        val currentTextEnd = currentText.substring(exactCharacterDifferenceIndex + max(0, differenceDelta))
        val computedTextEnd = computedText.substring(exactCharacterDifferenceIndex + max(0, -differenceDelta))
        if (currentTextEnd != computedTextEnd) {
            // This is a case where it's not as simple as adding or removing a chunk.
            // Give up and wait for components to be recomputed.
            return emptyList()
        }
        if (differenceDelta > 0) {
            // A chunk of text was added.
            return components.map {
                Previewable(
                    start = if (it.start < exactCharacterDifferenceIndex) it.start else it.start + differenceDelta,
                    end = if (it.end < exactCharacterDifferenceIndex) it.end else it.end + differenceDelta,
                    id = it.id
                )
            }
        } else {
            // A chunk of text was removed.
            // In the case of a file with multiple components, when we delete a component, the index of the first
            // detected difference may be "too far", example it can be "export const |Foo" if we have repeated
            // "export const <story-name>" statements. We instead consider that the difference starts at the beginning
            // of the line, i.e. "|export const Foo".
            val start = currentText.lastIndexOf("\n", exactCharacterDifferenceIndex)
            // TODO: Double check this logic. It's likely incorrect.
            val end = currentText.lastIndexOf("\n", exactCharacterDifferenceIndex - differenceDelta)
            return components.filter {
                it.start < start || it.start >= end
            }.map {
                Previewable(
                    start = if (it.start < start) it.start else max(0, it.start + differenceDelta),
                    end = if (it.end < start) it.end else max(0, it.end + differenceDelta),
                    id = it.id
                )
            }
        }
    }

    fun crawlFile(file: VirtualFile, callback: (result: List<Previewable>) -> Unit) {
        if (!JS_EXTENSIONS.contains(file.extension) || !file.isInLocalFileSystem || !file.isWritable) {
            return callback(emptyList())
        }
        service.enqueueAction(project, { api ->
            val workspaceId =
                service.ensureWorkspaceReady(project, file.path) ?: return@enqueueAction callback(emptyList())
            val pendingText = pendingFileChanges.remove(file.path)
            if (pendingText != null) {
                api.updatePendingFile(
                    UpdatePendingFileRequest(
                        absoluteFilePath = file.path,
                        utf8Content = pendingText
                    )
                )
            }
            val analysisResponse = api.crawlFile(
                CrawlFileRequest(
                    workspaceId,
                    absoluteFilePath = file.path
                )
            )
            callback(analysisResponse.previewables)
        }, {
            "Warning: unable to compute components for ${file.path}"
        })
    }

    fun openPreview(absoluteFilePath: String, previewableId: String) {
        service.enqueueAction(project, { api ->
            val workspaceId = service.ensureWorkspaceReady(project, absoluteFilePath) ?: return@enqueueAction
            currentPreviewWorkspaceId?.let {
                if (workspaceId != it) {
                    api.stopPreview(StopPreviewRequest(workspaceId = it))
                }
            }
            currentPreviewWorkspaceId = workspaceId
            val startPreviewResponse = api.startPreview(StartPreviewRequest(workspaceId))
            val previewBaseUrl = startPreviewResponse.url
            OpenMenuStatusBarWidget(
                url = previewBaseUrl,
                onStop = { closePreview() },
                onOpenBrowser = { BrowserUtil.open(previewBaseUrl) }
            ).install(statusBar)
            val previewUrl = "$previewBaseUrl?p=${URLEncoder.encode(previewableId, "utf-8")}"
            app.invokeLater {
                var browser = previewBrowser
                if (browser == null) {
                    browser = JBCefBrowser()
                    previewBrowser = browser
                    val browserBase: JBCefBrowserBase = browser
                    val linkHandler = JBCefJSQuery.create(browserBase)
                    linkHandler.addHandler { link ->
                        BrowserUtil.browse(link)
                        return@addHandler null
                    }
                    browser.jbCefClient.addLoadHandler(
                        object : CefLoadHandlerAdapter() {
                            override fun onLoadEnd(browser: CefBrowser, frame: CefFrame, httpStatusCode: Int) {
                                browser.executeJavaScript(
                                    """
                        window.openInExternalBrowser = function(url) {
                            ${linkHandler.inject("url")}
                        };
                    """,
                                    browser.url,
                                    0
                                )
                            }
                        },
                        browser.cefBrowser
                    )
                    Disposer.register(browser, linkHandler)
                }
                if (previewToolWindow == null) {
                    previewToolWindow = ToolWindowManager.getInstance(project).registerToolWindow(
                        TOOL_WINDOW_ID
                    ) {
                        anchor = ToolWindowAnchor.RIGHT
                        icon = smallLogo
                        canCloseContent = false
                    }.apply {
                        contentManager.addContent(
                            ContentFactory.getInstance().createContent(
                                browser.component,
                                null,
                                false
                            )
                        )
                    }
                }
                val currentBrowserUrl = browser.cefBrowser.url
                if (currentBrowserUrl?.startsWith(previewBaseUrl) == true) {
                    browser.cefBrowser.executeJavaScript(
                        "window.postMessage({ kind: \"navigate\", previewableId: \"${previewableId}\" });",
                        previewUrl,
                        0
                    )
                } else {
                    browser.loadURL("$previewUrl#panel")
                }
                previewToolWindow?.show()
            }
        }, {
            "Warning: unable to open preview for $previewableId"
        })
    }

    fun closePreview(processKilled: Boolean = false) {
        @Suppress("UnstableApiUsage")
        statusBar.removeWidget(OpenMenuStatusBarWidget.ID)
        previewToolWindow?.remove()
        previewToolWindow = null
        previewBrowser?.let {
            Disposer.dispose(it)
        }
        previewBrowser = null
        currentPreviewWorkspaceId?.let { workspaceId ->
            if (processKilled) {
                return
            }
            service.enqueueAction(project, { api ->
                api.stopPreview(StopPreviewRequest(workspaceId = workspaceId))
            }, {
                "Warning: unable to close preview"
            })
        }
        currentPreviewWorkspaceId = null
    }

    override fun dispose() {
        closePreview()
        consoleView = null
        consoleToolWindow = null
        service.enqueueAction(project, {
            service.disposeWorkspaces(project)
        }, {
            "Warning: unable to dispose of workspaces"
        })
    }
}
