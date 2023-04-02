package com.previewjs.intellij.plugin

import com.intellij.codeInsight.hints.InlayHintsProvider
import com.intellij.codeInsight.hints.InlayHintsProviderFactory
import com.intellij.codeInsight.hints.ProviderInfo
import com.intellij.lang.Language
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project

@Suppress("UnstableApiUsage")
class InlayProviderFactory : InlayHintsProviderFactory {
    override fun getLanguages(): Iterable<Language> {
        return Language.getRegisteredLanguages()
            // TODO: Also Vue and Svelte.
            .filter { l -> l.id == "textmate" || l.id == "JavaScript" || l.id == "TypeScript" || l.id == "TypeScript JSX" }
    }

    override fun getProvidersInfoForLanguage(language: Language): List<InlayHintsProvider<out Any>> {
        return listOf(InlayProvider())
    }
}
