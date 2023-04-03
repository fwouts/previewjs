package com.previewjs.intellij.plugin.inlays

import com.intellij.codeInsight.hints.ChangeListener
import com.intellij.codeInsight.hints.FactoryInlayHintsCollector
import com.intellij.codeInsight.hints.ImmediateConfigurable
import com.intellij.codeInsight.hints.InlayHintsProvider
import com.intellij.codeInsight.hints.InlayHintsProviderFactory
import com.intellij.codeInsight.hints.InlayHintsSink
import com.intellij.codeInsight.hints.NoSettings
import com.intellij.codeInsight.hints.ProviderInfo
import com.intellij.codeInsight.hints.SettingsKey
import com.intellij.lang.Language
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.previewjs.intellij.plugin.services.ProjectService
import kotlinx.coroutines.runBlocking
import javax.swing.JPanel

@Suppress("UnstableApiUsage")
class InlayProviderFactory : InlayHintsProviderFactory {
    companion object {
        // Note #1: "textmate" is what's used in IntelliJ CE for JS/TS(X) files.
        // Note #2: "TEXT" is what's used in IntelliJ CE for Vue files.
        val LANGUAGE_IDS =
            setOf("TEXT", "textmate", "ECMAScript 6", "JavaScript", "TypeScript", "TypeScript JSX", "SvelteHTML", "VueJS")

        // Full list from IntelliJ IDEA 2023.1:
        // TOML, JSON, HgIgnore, InjectedFreeMarker, MySQL, AZURE, TypeScript, AIDL, AngularJS, PostCSS, Snowflake, Micronaut-MongoDB-JSON, Redis, XML, SQL92, TSQL, protobase, Angular2Svg, JSUnicodeRegexp, Nashorn JS, JVM, EL, Gherkin, AndroidDataBinding, SQLDateTime, SVG, , XHTML, RoomSql, DB2, Properties, XPath, DB2_ZOS, FTL>, JavaScript 1.8, ThymeleafSpringSecurityExtras, Renderscript, Angular2, prototext, ThymeleafTemplatesExpressions, H2, XsdRegExp, HTML, LESS, JQL, yaml, MongoJSExt, JSPX, Flow JS, PostgreSQL, JQuery-CSS, GitIgnore, Lombok.Config, Dockerfile, KND, CouchbaseQuery, Qute, JSRegexp, ThymeleafExpressions, VueExpr, SQLite, SparkSQL, GenericSQL, JSP, OracleSqlPlus, UastContextLanguage, Markdown, DTD, TEXT, DeviceSpec, UAST, ThymeleafUrlExpressions, EQL, Groovy, TypeScript JSX, SCSS, JSONPath, JSON5, Vue, Exasol, HSQLDB, protobuf, EditorConfig, ECMA Script Level 4, Greenplum, Cookie, kotlin, textmate, ClickHouse, HtmlCompatible, EJBQL, Derby, SPI, Cockroach, JavaScript, Angular2Html, MicronautDataQL, IntegrationPerformanceTest, VTL, GitExclude, MultiDexKeep, Shell Script, CassandraQL, RegExp, HiveQL, Smali, Manifest, SHRINKER_CONFIG, JAVA, LogcatFilter, VueJS, IgnoreLang, SQL, $XSLT, PointcutExpression, MariaDB, DB2_IS, AGSL, Oracle, SpEL, SpringDataQL, JSON Lines, FTL], BigQuery, MongoJS, YouTrack, CSS, MongoDB, Metadata JSON, Vertica, SASS, Sybase, ThymeleafIterateExpressions, ThymeleafTemplatesFragmentExpressions, ECMAScript 6, XPath2, HTTP Request, RELAX-NG, DockerIgnore, HttpClientHandlerJavaScriptDialect, FTL, JPAQL, HQL, JShellLanguage, VueTS, MySQL based, MongoDB-JSON, Spring-MongoDB-JSON, Redshift
    }

    @Deprecated("Use getProvidersInfo without project", replaceWith = ReplaceWith("getProvidersInfo()"))
    override fun getProvidersInfo(project: Project): List<ProviderInfo<out Any>> {
        return getLanguages().map { l -> ProviderInfo(l, InlayProvider()) }
    }

    override fun getProvidersInfo(): List<ProviderInfo<out Any>> {
        return getLanguages().map { l -> ProviderInfo(l, InlayProvider()) }
    }

    override fun getLanguages(): Iterable<Language> {
        return Language.getRegisteredLanguages()
            .filter { l -> LANGUAGE_IDS.contains(l.id) }
    }

    override fun getProvidersInfoForLanguage(language: Language): List<InlayHintsProvider<out Any>> {
        return listOf(InlayProvider())
    }

    class InlayProvider : InlayHintsProvider<NoSettings> {
        override val key = SettingsKey<NoSettings>(InlayProvider::class.qualifiedName!!)
        override val name = "Preview.js hints"
        override val previewText = null
        override fun createSettings() = NoSettings()

        override val isVisibleInSettings = false

        override fun isLanguageSupported(language: Language): Boolean {
            return LANGUAGE_IDS.contains(language.id)
        }

        override fun getCollectorFor(
            file: PsiFile,
            editor: Editor,
            settings: NoSettings,
            sink: InlayHintsSink
        ) = object : FactoryInlayHintsCollector(editor) {
            override fun collect(element: PsiElement, editor: Editor, sink: InlayHintsSink): Boolean {
                if (element !is PsiFile) {
                    return false
                }
                val projectService = element.project.service<ProjectService>()
                val components = runBlocking {
                    projectService.computeComponents(element.virtualFile, editor.document)
                }
                for (component in components) {
                    sink.addBlockElement(
                        component.start,
                        relatesToPrecedingText = false,
                        showAbove = true,
                        priority = 0,
                        presentation = factory.referenceOnHover(
                            factory.roundWithBackground(factory.smallText("Open ${component.componentName} in Preview.js"))
                        ) { _, _ ->
                            projectService.openPreview(element.virtualFile.path, component.componentId)
                        }
                    )
                }
                return false
            }
        }

        override fun createConfigurable(settings: NoSettings): ImmediateConfigurable {
            return object : ImmediateConfigurable {
                override fun createComponent(listener: ChangeListener) = JPanel()
            }
        }
    }
}
