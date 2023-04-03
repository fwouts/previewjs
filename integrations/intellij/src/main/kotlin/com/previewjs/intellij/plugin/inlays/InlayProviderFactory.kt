package com.previewjs.intellij.plugin.inlays

import com.intellij.codeInsight.hints.InlayHintsProvider
import com.intellij.codeInsight.hints.InlayHintsProviderFactory
import com.intellij.codeInsight.hints.ProviderInfo
import com.intellij.lang.Language

@Suppress("UnstableApiUsage")
class InlayProviderFactory : InlayHintsProviderFactory {
    companion object {
        // TODO: Also Vue.
        val LANGUAGE_IDS = setOf("textmate", "JavaScript", "TypeScript", "TypeScript JSX", "SvelteHTML")
    }

    override fun getProvidersInfo(): List<ProviderInfo<out Any>> {
        return getLanguages().map { l -> ProviderInfo(l, InlayProvider()) }
    }

    fun getLanguages(): Iterable<Language> {
        return Language.getRegisteredLanguages()
            .filter { l -> LANGUAGE_IDS.contains(l.id) }
    }

    fun getProvidersInfoForLanguage(language: Language): List<InlayHintsProvider<out Any>> {
        return listOf(InlayProvider())
    }
}
