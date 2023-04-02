package com.previewjs.intellij.plugin

import com.intellij.codeInsight.hints.ChangeListener
import com.intellij.codeInsight.hints.FactoryInlayHintsCollector
import com.intellij.codeInsight.hints.ImmediateConfigurable
import com.intellij.codeInsight.hints.InlayHintsProvider
import com.intellij.codeInsight.hints.InlayHintsSink
import com.intellij.codeInsight.hints.NoSettings
import com.intellij.codeInsight.hints.SettingsKey
import com.intellij.codeInsight.hints.presentation.InlayPresentation
import com.intellij.codeInsight.hints.presentation.MouseButton
import com.intellij.lang.Language
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.text.StringUtil
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.previewjs.intellij.plugin.services.ProjectService
import org.jetbrains.annotations.ApiStatus.Experimental
import java.awt.Cursor
import javax.swing.JPanel

@Suppress("UnstableApiUsage")
class InlayProvider : InlayHintsProvider<NoSettings> {
    override val key = SettingsKey<NoSettings>(InlayProvider::class.qualifiedName!!)
    override val name = "Preview.js hints"
    override val previewText = null
    override fun createSettings() = NoSettings()

    override val isVisibleInSettings = false

    override fun isLanguageSupported(language: Language): Boolean {
        val logger = Logger.getInstance(InlayProvider::class.java)
        logger.warn("Is language supported: ${language.id}")
        return true
    }

    override fun getCollectorFor(
        file: PsiFile,
        editor: Editor,
        settings: NoSettings,
        sink: InlayHintsSink
    ): FactoryInlayHintsCollector {
        val logger = Logger.getInstance(InlayProvider::class.java)
        logger.warn("Creating collector for ${file.virtualFile.path} (${file.language.id})")
        // TODO: Recycle it?
        return object : FactoryInlayHintsCollector(editor) {
            override fun collect(element: PsiElement, editor: Editor, sink: InlayHintsSink): Boolean {
                logger.warn("Collecting hints for ${file.virtualFile.path}")
                val projectService = file.project.service<ProjectService>()
                val components = projectService.getComponents(file.virtualFile.path)
                logger.warn("Components for ${file.virtualFile.path} = ${components.size}")
                for (component in components) {
                    val presentation = factory.withCursorOnHover(
                        factory.roundWithBackground(factory.smallText("Open ${component.componentName} in Preview.js")),
                        Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
                    )
                    val button = factory.onClick(presentation, MouseButton.Left) { _, _ ->
                        logger.warn("Click!")
                    }

                    // TODO: Make sure this is correct when not saved yet, appears to be offset weird.
                    // Probably because we haven't sent the document over to Preview.js yet?
                    sink.addBlockElement(
                        component.start,
                        relatesToPrecedingText = false,
                        showAbove = true,
                        priority = 0,
                        button
                    )
                }
                return false
            }
        }
    }

    override fun createConfigurable(settings: NoSettings): ImmediateConfigurable {
        return object : ImmediateConfigurable {
            override fun createComponent(listener: ChangeListener) = JPanel()
        }
    }
}