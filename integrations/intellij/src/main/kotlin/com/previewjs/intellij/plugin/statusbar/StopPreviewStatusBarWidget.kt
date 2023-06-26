package com.previewjs.intellij.plugin.statusbar

import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.popup.JBPopup
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.WindowManager
import com.intellij.openapi.wm.impl.status.widget.StatusBarWidgetSettings
import com.intellij.openapi.wm.impl.status.widget.StatusBarWidgetsManager
import com.previewjs.intellij.plugin.services.ProjectService

class StopPreviewStatusBarWidget(private val projectService: ProjectService) : StatusBarWidget {
    companion object {
        const val ID = "previewjs.stop"

        fun updateStatusBar(project: Project, showWidget: Boolean) {
            val statusBarWidgetsManager = project.getService(StatusBarWidgetsManager::class.java)
            val widgetFactory = statusBarWidgetsManager.getWidgetFactories().find { it.id == StopPreviewStatusBarWidgetFactory.ID } ?: return
            StatusBarWidgetSettings.getInstance().setEnabled(widgetFactory, showWidget)
            statusBarWidgetsManager.updateWidget(widgetFactory)
        }
    }

    override fun ID(): String = ID

    override fun getPresentation(): StatusBarWidget.WidgetPresentation {
        return object : StatusBarWidget.MultipleTextValuesPresentation {
            override fun getPopup(): JBPopup? {
                projectService.closePreview()
                return null
            }

            override fun getSelectedValue(): String {
                // TODO: Show the correct URL.
                return "🛑 Preview.js running at http://localhost:5123"
            }

            override fun getTooltipText(): String? {
                return null
            }
        }
    }
}
