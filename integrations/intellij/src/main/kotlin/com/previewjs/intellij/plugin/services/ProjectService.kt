package com.previewjs.intellij.plugin.services

import com.intellij.execution.filters.TextConsoleBuilderFactory
import com.intellij.execution.ui.ConsoleView
import com.intellij.execution.ui.ConsoleViewContentType
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowAnchor
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import com.previewjs.intellij.plugin.api.AnalyzeFileRequest
import com.previewjs.intellij.plugin.api.AnalyzedFileComponent
import com.previewjs.intellij.plugin.api.StartPreviewRequest
import com.previewjs.intellij.plugin.api.StopPreviewRequest
import com.previewjs.intellij.plugin.api.UpdatePendingFileRequest
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import java.net.URLEncoder
import javax.imageio.ImageIO
import javax.swing.ImageIcon

@Service(Service.Level.PROJECT)
class ProjectService(private val project: Project) : Disposable {
    companion object {
        private val JS_EXTENSIONS = setOf("js", "jsx", "ts", "tsx", "svelte", "vue")
        private val LIVE_UPDATING_EXTENSIONS =
            JS_EXTENSIONS + setOf("css", "sass", "scss", "less", "styl", "stylus", "svg")
    }

    private val app = ApplicationManager.getApplication()
    private val smallLogo = ImageIO.read(javaClass.getResource("/logo-13.png"))
    private val service = app.getService(PreviewJsSharedService::class.java)
    private var consoleView: ConsoleView? = null
    private var consoleToolWindow: ToolWindow? = null
    private var previewBrowser: JBCefBrowser? = null
    private var previewToolWindow: ToolWindow? = null
    private var currentPreviewWorkspaceId: String? = null

    init {
        EditorFactory.getInstance().eventMulticaster.addDocumentListener(
            object : DocumentListener {
                override fun documentChanged(event: DocumentEvent) {
                    val file = FileDocumentManager.getInstance().getFile(event.document)
                    if (file?.extension == null || !LIVE_UPDATING_EXTENSIONS.contains(file.extension) || !file.isInLocalFileSystem || !file.isWritable || event.document.text.length > 1_048_576) {
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
            icon = ImageIcon(smallLogo)
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

    suspend fun computeComponents(file: VirtualFile, document: Document): List<AnalyzedFileComponent> {
        if (!JS_EXTENSIONS.contains(file.extension) || !file.isInLocalFileSystem || !file.isWritable || document.text.length > 1_048_576) {
            return emptyList()
        }
        service.ensureApiInitialized(project)
        return service.withApi { api ->
            val workspaceId = service.ensureWorkspaceReady(project, file.path) ?: return@withApi emptyList()
            api.updatePendingFile(
                UpdatePendingFileRequest(
                    absoluteFilePath = file.path,
                    utf8Content = document.text
                )
            )
            return@withApi api.analyzeFile(
                AnalyzeFileRequest(
                    workspaceId,
                    absoluteFilePath = file.path
                )
            ).components
        } ?: emptyList()
    }

    fun openPreview(absoluteFilePath: String, componentId: String) {
        val app = ApplicationManager.getApplication()
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
                        icon = ImageIcon(smallLogo)
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
