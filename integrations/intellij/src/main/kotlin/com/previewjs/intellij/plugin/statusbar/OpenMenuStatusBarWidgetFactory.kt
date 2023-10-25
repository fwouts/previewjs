package com.previewjs.intellij.plugin.statusbar

import com.intellij.ide.BrowserUtil
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.NlsContexts.ConfigurableName
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.previewjs.intellij.plugin.services.ProjectService
import org.jetbrains.annotations.NonNls

class OpenMenuStatusBarWidgetFactory : StatusBarWidgetFactory {
    companion object {
        private var EMPTY_WIDGET = object : StatusBarWidget {
            override fun ID(): String = OpenMenuStatusBarWidget.ID

            override fun install(statusBar: StatusBar) {
                // Do nothing.
            }

            override fun dispose() {
                // Do nothing.
            }
        }
    }

    override fun getId(): @NonNls String {
        return OpenMenuStatusBarWidget.ID
    }

    override fun getDisplayName(): @ConfigurableName String {
        return "Preview.js Status"
    }

    override fun createWidget(project: Project): StatusBarWidget {
        val projectService = project.getService(ProjectService::class.java)
        val previewBaseUrl = projectService.getPreviewBaseUrl() ?: return EMPTY_WIDGET
        return OpenMenuStatusBarWidget(
            url = previewBaseUrl,
            onStop = { projectService.closePreview() },
            onOpenBrowser = { BrowserUtil.open(previewBaseUrl) }
        )
    }

    override fun disposeWidget(widget: StatusBarWidget) {
        widget.dispose()
    }

    override fun canBeEnabledOn(statusBar: StatusBar): Boolean {
        return true
    }

    override fun isAvailable(project: Project): Boolean {
        return project.getService(ProjectService::class.java).getPreviewBaseUrl() != null
    }
}
