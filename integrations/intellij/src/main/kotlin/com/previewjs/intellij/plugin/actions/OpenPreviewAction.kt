package com.previewjs.intellij.plugin.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.fileEditor.FileEditorManager
import com.previewjs.intellij.plugin.services.ProjectService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class OpenPreviewAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val notificationGroup = NotificationGroupManager.getInstance().getNotificationGroup("Preview.js")
        val project = e.project ?: return
        val manager = FileEditorManager.getInstance(project)
        val selectedTextEditor = manager.selectedTextEditor
        if (selectedTextEditor == null) {
            notificationGroup.createNotification(
                "No file is currently selected",
                NotificationType.ERROR
            ).notify(project)
            return
        }
        val offset = manager.selectedTextEditor?.selectionModel?.selectionStart
        CoroutineScope(Dispatchers.IO).launch {
            val projectService = project.getService(ProjectService::class.java)
            val components =
                projectService.computeComponents(selectedTextEditor.virtualFile, selectedTextEditor.document)
            if (components.isEmpty()) {
                notificationGroup.createNotification(
                    "No components detected in ${selectedTextEditor.virtualFile.path}",
                    NotificationType.ERROR
                ).notify(project)
                return@launch
            }
            val component =
                components.find { c -> offset != null && offset >= c.start && offset <= c.end } ?: components[0]
            projectService.openPreview(selectedTextEditor.virtualFile.path, component.componentId)
        }
    }

    override fun getActionUpdateThread(): ActionUpdateThread {
        return ActionUpdateThread.BGT
    }
}
