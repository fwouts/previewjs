package com.previewjs.intellij.plugin.inlays

import com.intellij.codeInsight.hints.declarative.InlayActionHandler
import com.intellij.codeInsight.hints.declarative.InlayActionPayload
import com.intellij.codeInsight.hints.declarative.StringInlayActionPayload
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.previewjs.intellij.plugin.services.ProjectService

class PreviewJsInlayActionHandler() : InlayActionHandler {
    override fun handleClick(editor: Editor, payload: InlayActionPayload) {
        val project = editor.project ?: return
        payload as StringInlayActionPayload
        val projectService = project.service<ProjectService>()
        projectService.openPreview(editor.virtualFile.path, payload.text)
    }
}
