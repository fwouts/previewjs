package com.previewjs.intellij.plugin.listeners

import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectManagerListener
import com.previewjs.intellij.plugin.services.ProjectService

internal class ProjectManagerListener : ProjectManagerListener {
    override fun projectOpened(project: Project) {
        project.service<ProjectService>()
    }
}
