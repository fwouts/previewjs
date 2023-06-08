package com.previewjs.intellij.plugin.services

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
import com.intellij.openapi.project.Project
import com.intellij.openapi.roots.ProjectFileIndex
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.readText
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowAnchor
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.psi.PsiFile
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import com.previewjs.intellij.plugin.api.AnalyzeFileRequest
import com.previewjs.intellij.plugin.api.AnalyzedFileComponent
import com.previewjs.intellij.plugin.api.StartPreviewRequest
import com.previewjs.intellij.plugin.api.StopPreviewRequest
import com.previewjs.intellij.plugin.api.UpdatePendingFileRequest
import org.apache.commons.lang.StringUtils
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import java.net.URLEncoder
import kotlin.math.max

@Service(Service.Level.PROJECT)
class ProjectService(private val project: Project) : Disposable {
    companion object {
        private val JS_EXTENSIONS = setOf("js", "jsx", "ts", "tsx", "svelte", "vue")
        private val LIVE_UPDATING_EXTENSIONS =
            JS_EXTENSIONS + setOf("css", "sass", "scss", "less", "styl", "stylus", "svg")
    }

    private val app = ApplicationManager.getApplication()
    private val smallLogo = IconLoader.getIcon("/logo.svg", javaClass)
    private val service = app.getService(PreviewJsSharedService::class.java)
    private var consoleView: ConsoleView? = null
    private var consoleToolWindow: ToolWindow? = null
    private var previewBrowser: JBCefBrowser? = null
    private var previewToolWindow: ToolWindow? = null
    private var currentPreviewWorkspaceId: String? = null
    private var componentMap = mutableMapOf<String, Pair<String, List<AnalyzedFileComponent>>>()

    init {
        val projectFileIndex = ProjectFileIndex.getInstance(project)
        val connection = project.messageBus.connect(this)

        EditorFactory.getInstance().eventMulticaster.addDocumentListener(
            object : DocumentListener {
                override fun documentChanged(event: DocumentEvent) {
                    val file = FileDocumentManager.getInstance().getFile(event.document)
                    if (file?.extension == null || !LIVE_UPDATING_EXTENSIONS.contains(file.extension) || !file.isInLocalFileSystem || !file.isWritable || !projectFileIndex.isInProject(file) || event.document.text.length > 1_048_576) {
                        return
                    }
                    service.enqueueAction(project, { api ->
                        service.ensureWorkspaceReady(project, file.path) ?: return@enqueueAction
                        api.updatePendingFile(
                            UpdatePendingFileRequest(
                                absoluteFilePath = file.path,
                                utf8Content = event.document.text
                            )
                        )
                    }, {
                        "Warning: unable to update pending file ${file.path}"
                    })
                }
            },
            this
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
                    onFileOpenedOrUpdated(file)
                }

                override fun fileClosed(source: FileEditorManager, file: VirtualFile) {
                    onFileClosed(file)
                }
            }
        )
        FileEditorManager.getInstance(project).allEditors.forEach { editor ->
            onFileOpenedOrUpdated(editor.file)
        }
    }

    fun printToConsole(text: String) {
        app.invokeLater {
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

    private fun onFileOpenedOrUpdated(file: VirtualFile) {
        val text = file.readText()
        computeComponents(file, text) { components ->
            componentMap[file.path] = Pair(text, components)
        }
    }

    private fun onFileClosed(file: VirtualFile) {
        componentMap.remove(file.path)
    }

    fun getPrecomputedComponents(psiFile: PsiFile): List<AnalyzedFileComponent> {
        val currentText = psiFile.text
        val computed = componentMap[psiFile.virtualFile.path] ?: return emptyList()
        val (computedText, components) = computed
        if (currentText == computedText) {
            return components
        }
        val exactCharacterDifferenceIndex = StringUtils.indexOfDifference(currentText, computedText)
        // Assume that a chunk of text was either added or removed where the difference occurs.
        val differenceDelta = currentText.length - computedText.length
        val currentTextEnd = currentText.substring(exactCharacterDifferenceIndex + max(0, differenceDelta))
        val computedTextEnd = computedText.substring(exactCharacterDifferenceIndex + max(0, -differenceDelta))
        if (currentTextEnd != computedTextEnd) {
            return emptyList()
        }
        if (differenceDelta > 0) {
            // A chunk of text was added.
            return components.map {
                AnalyzedFileComponent(
                    start = if (it.start < exactCharacterDifferenceIndex) it.start else it.start + differenceDelta,
                    end = if (it.end < exactCharacterDifferenceIndex) it.end else it.end + differenceDelta,
                    componentId = it.componentId
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
                AnalyzedFileComponent(
                    start = if (it.start < start) it.start else it.start + differenceDelta,
                    end = if (it.end < start) it.end else it.end + differenceDelta,
                    componentId = it.componentId
                )
            }
        }
    }

    fun computeComponents(file: VirtualFile, text: String, callback: (result: List<AnalyzedFileComponent>) -> Unit) {
        if (!JS_EXTENSIONS.contains(file.extension) || !file.isInLocalFileSystem || !file.isWritable) {
            return callback(emptyList())
        }
        service.enqueueAction(project, { api ->
            val workspaceId =
                service.ensureWorkspaceReady(project, file.path) ?: return@enqueueAction callback(emptyList())
            api.updatePendingFile(
                UpdatePendingFileRequest(
                    absoluteFilePath = file.path,
                    utf8Content = text
                )
            )
            callback(
                api.analyzeFile(
                    AnalyzeFileRequest(
                        workspaceId,
                        absoluteFilePath = file.path
                    )
                ).components
            )
        }, {
            "Warning: unable to compute components for ${file.path}"
        })
    }

    fun openPreview(absoluteFilePath: String, componentId: String) {
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
            val previewUrl = "$previewBaseUrl?p=${URLEncoder.encode(componentId, "utf-8")}"
            app.invokeLater {
                var browser = previewBrowser
                if (browser == null) {
                    browser = JBCefBrowser()
                    previewBrowser = browser
                    Disposer.register(this@ProjectService, browser)
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
                    previewToolWindow = ToolWindowManager.getInstance(project).registerToolWindow(
                        "Preview.js"
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
                        "window.postMessage({ kind: \"navigate\", componentId: \"${componentId}\" });",
                        previewUrl,
                        0
                    )
                } else {
                    browser.loadURL(previewUrl)
                }
                previewToolWindow?.show()
            }
        }, {
            "Warning: unable to open preview with component ID: $componentId"
        })
    }

    override fun dispose() {
        previewBrowser = null
        previewToolWindow = null
        consoleView = null
        consoleToolWindow = null
        service.enqueueAction(project, { api ->
            currentPreviewWorkspaceId?.let {
                api.stopPreview(StopPreviewRequest(workspaceId = it))
            }
            service.disposeWorkspaces(project)
            currentPreviewWorkspaceId = null
        }, {
            "Warning: unable to dispose of workspaces"
        })
    }
}
