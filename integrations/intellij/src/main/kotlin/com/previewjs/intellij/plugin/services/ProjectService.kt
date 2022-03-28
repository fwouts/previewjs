package com.previewjs.intellij.plugin.services

import com.intellij.codeInsight.hints.*
import com.intellij.codeInsight.hints.presentation.PresentationFactory
import com.intellij.codeInsight.hints.presentation.RecursivelyUpdatingRootPresentation
import com.intellij.execution.filters.TextConsoleBuilderFactory
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.Inlay
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.editor.impl.EditorImpl
import com.intellij.openapi.fileEditor.*
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.wm.RegisterToolWindowTask
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowAnchor
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.ui.content.ContentManagerListener
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import com.previewjs.intellij.plugin.api.*
import kotlinx.coroutines.*
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import java.awt.event.ComponentEvent
import java.awt.event.ComponentListener
import java.util.*
import javax.swing.ImageIcon
import kotlin.collections.HashMap
import kotlin.collections.HashSet
import kotlin.concurrent.schedule

class ProjectService(private val project: Project) : Disposable {
    companion object {
        const val INLAY_PRIORITY = 1000
    }

    private val app = ApplicationManager.getApplication()
    private val service = app.getService(PreviewJsSharedService::class.java)
    private val editorManager = FileEditorManager.getInstance(project)
    private var refreshTimerTask: TimerTask? = null
    private var previewBrowser: JBCefBrowser? = null
    private var previewToolWindow: ToolWindow? = null
    private var currentPreviewId: String? = null

    val consoleView = TextConsoleBuilderFactory.getInstance().createBuilder(project).console

    init {
        EditorFactory.getInstance().eventMulticaster.addDocumentListener(object : DocumentListener {
            override fun documentChanged(event: DocumentEvent) {
                val file = FileDocumentManager.getInstance().getFile(event.document)
                if (file != null && file.isInLocalFileSystem && file.isWritable && event.document.text.length <= 1_048_576) {
                    service.enqueueAction(project, { api ->
                        service.ensureWorkspaceReady(project, file.path) ?: return@enqueueAction
                        api.updatePendingFile(UpdatePendingFileRequest(
                                absoluteFilePath = file.path,
                                utf8Content = event.document.text
                        ))
                    }, {
                        "Warning: unable to update pending file ${file.path}"
                    })
                    refreshTimerTask?.cancel()
                    refreshTimerTask = Timer("PreviewJsHintRefresh", false).schedule(500) {
                        refreshTimerTask = null
                        app.invokeLater(Runnable {
                            updateComponents(file, event.document.text)
                        })
                    }
                }
            }
        }, this)

        project.messageBus.connect(project)
            .subscribe(FileEditorManagerListener.FILE_EDITOR_MANAGER, object : FileEditorManagerListener {
                override fun fileOpened(source: FileEditorManager, file: VirtualFile) {
                    updateComponents(file)
                }
            })

        for (file in editorManager.openFiles) {
            updateComponents(file)
        }
    }

    private fun updateComponents(file: VirtualFile, content: String? = null) {
        val fileEditors = editorManager.getEditors(file)
        service.enqueueAction(project, { api ->
            val workspaceId = service.ensureWorkspaceReady(project, file.path) ?: return@enqueueAction
            content?.let { content ->
                api.updatePendingFile(UpdatePendingFileRequest(
                        absoluteFilePath = file.path,
                        utf8Content = content
                ))
            }
            val components = api.analyzeFile(AnalyzeFileRequest(
                    workspaceId,
                    absoluteFilePath = file.path,
            )).components
            app.invokeLater(Runnable {
                updateComponentHints(file, fileEditors, components)
            })
        }, {
            "Warning: unable to find components in ${file.path}"
        })
    }

    private fun updateComponentHints(
        file: VirtualFile,
        fileEditors: Array<FileEditor>,
        components: List<AnalyzedFileComponent>
    ) {
        for (fileEditor in fileEditors) {
            if (fileEditor is TextEditor) {
                val editor = fileEditor.editor
                if (editor is EditorImpl) {
                    val presentationFactory = PresentationFactory(editor)
                    val offsets = HashSet<Int>()
                    for (component in components) {
                        offsets.add(component.offset)
                    }
                    val existingBlockByOffset = HashMap<Int, Inlay<*>>()
                    for (block in editor.inlayModel.getBlockElementsInRange(0, Int.MAX_VALUE)) {
                        if (offsets.contains(block.offset)) {
                            existingBlockByOffset[block.offset] = block
                        } else {
                            Disposer.dispose(block)
                        }
                    }
                    for (component in components) {
                        val existingBlock = existingBlockByOffset[component.offset]
                        if (existingBlock == null) {
                            editor.inlayModel.addBlockElement(
                                component.offset,
                                false,
                                true,
                                INLAY_PRIORITY,
                                InlineInlayRenderer(
                                    listOf(
                                        HorizontalConstrainedPresentation(
                                            RecursivelyUpdatingRootPresentation(
                                                presentationFactory.referenceOnHover(
                                                    presentationFactory.text("Open ${component.componentName} in Preview.js")
                                                ) { _, _ -> openPreview(file.path, component.componentId) }
                                            ),
                                            HorizontalConstraints(INLAY_PRIORITY, false)
                                        )
                                    )
                                )
                            )
                        }
                    }
                }
            }
        }
    }

    private fun openPreview(absoluteFilePath: String, componentId: String) {
        val app = ApplicationManager.getApplication()
        service.enqueueAction(project, { api ->
            val workspaceId = service.ensureWorkspaceReady(project, absoluteFilePath) ?: return@enqueueAction
            val startPreviewResponse = api.startPreview(StartPreviewRequest(workspaceId))
            val previousPreviewId = currentPreviewId
            if (previousPreviewId != null && previousPreviewId != startPreviewResponse.previewId) {
                api.stopPreview(StopPreviewRequest(previewId = previousPreviewId))
            }
            currentPreviewId = startPreviewResponse.previewId
            val previewBaseUrl = startPreviewResponse.url
            val previewUrl = "$previewBaseUrl?p=$componentId"
            app.invokeLater(Runnable {
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
                    browser.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
                        override fun onLoadEnd(browser: CefBrowser, frame: CefFrame, httpStatusCode: Int) {
                            browser.executeJavaScript(
                                """
                        window.openInExternalBrowser = function(url) {
                            ${linkHandler.inject("url")}
                        };
                    """,
                                browser.url,
                                0
                            );
                        }
                    }, browser.cefBrowser)
                    Disposer.register(browser, linkHandler)
                    previewToolWindow = ToolWindowManager.getInstance(project).registerToolWindow(
                        RegisterToolWindowTask(
                            id = "Preview.js",
                            anchor = ToolWindowAnchor.RIGHT,
                            icon = ImageIcon(javaClass.getResource("/logo-16.png")),
                            component = browser.component,
                            canCloseContent = false
                        )
                    )
                }
                val currentBrowserUrl = browser.cefBrowser.url
                if (currentBrowserUrl?.startsWith(previewBaseUrl) == true) {
                    browser.cefBrowser.executeJavaScript("window.__previewjs_navigate(\"${componentId}\");", previewUrl, 0)
                } else {
                    browser.loadURL(previewUrl)
                }
                previewToolWindow?.show()
            })
        }, {
            "Warning: unable to open preview with component ID: $componentId"
        })
    }

    override fun dispose() {
        refreshTimerTask?.cancel()
        refreshTimerTask = null
        previewBrowser = null
        previewToolWindow = null
        service.enqueueAction(project, { api ->
            val previewId = currentPreviewId
            if (previewId != null) {
                api.stopPreview(StopPreviewRequest(previewId = previewId))
            }
            service.disposeWorkspaces(project)
            currentPreviewId = null
        }, {
            "Warning: unable to dispose of workspaces"
        })
    }
}
