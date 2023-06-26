package com.previewjs.intellij.plugin.statusbar

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.intellij.openapi.wm.impl.status.widget.StatusBarWidgetSettings
import com.previewjs.intellij.plugin.services.ProjectService

class StopPreviewStatusBarWidgetFactory : StatusBarWidgetFactory {
    companion object {
        const val ID = "previewjs.status.bar"
    }

    init {
        StatusBarWidgetSettings.getInstance().setEnabled(this, false)
    }

    override fun getId(): String {
        return ID
    }

    override fun getDisplayName(): String {
        return "Preview.js status bar"
    }

    override fun createWidget(project: Project): StatusBarWidget {
        val projectService = project.getService(ProjectService::class.java)
        return StopPreviewStatusBarWidget(projectService)
    }
}
