package com.previewjs.intellij.plugin.inlays

import com.intellij.codeInsight.hints.declarative.*
import com.intellij.lang.Language
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.util.text.StringUtil
import com.intellij.psi.PsiFile
import com.previewjs.intellij.plugin.services.ProjectService
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking

class PreviewJsInlayProviderFactory : InlayHintsProviderFactory {
    companion object {
        // Note #1: "textmate" is what's used in IntelliJ CE for JS/TS(X) files.
        // Note #2: "TEXT" is what's used in IntelliJ CE for Vue files.
        val LANGUAGE_IDS = setOf(
            "TEXT", "textmate", "ECMAScript 6", "JavaScript", "TypeScript", "TypeScript JSX", "SvelteHTML", "VueJS"
        )

        // Full list from IntelliJ IDEA 2023.1:
        // TOML, JSON, HgIgnore, InjectedFreeMarker, MySQL, AZURE, TypeScript, AIDL, AngularJS, PostCSS, Snowflake, Micronaut-MongoDB-JSON, Redis, XML, SQL92, TSQL, protobase, Angular2Svg, JSUnicodeRegexp, Nashorn JS, JVM, EL, Gherkin, AndroidDataBinding, SQLDateTime, SVG, , XHTML, RoomSql, DB2, Properties, XPath, DB2_ZOS, FTL>, JavaScript 1.8, ThymeleafSpringSecurityExtras, Renderscript, Angular2, prototext, ThymeleafTemplatesExpressions, H2, XsdRegExp, HTML, LESS, JQL, yaml, MongoJSExt, JSPX, Flow JS, PostgreSQL, JQuery-CSS, GitIgnore, Lombok.Config, Dockerfile, KND, CouchbaseQuery, Qute, JSRegexp, ThymeleafExpressions, VueExpr, SQLite, SparkSQL, GenericSQL, JSP, OracleSqlPlus, UastContextLanguage, Markdown, DTD, TEXT, DeviceSpec, UAST, ThymeleafUrlExpressions, EQL, Groovy, TypeScript JSX, SCSS, JSONPath, JSON5, Vue, Exasol, HSQLDB, protobuf, EditorConfig, ECMA Script Level 4, Greenplum, Cookie, kotlin, textmate, ClickHouse, HtmlCompatible, EJBQL, Derby, SPI, Cockroach, JavaScript, Angular2Html, MicronautDataQL, IntegrationPerformanceTest, VTL, GitExclude, MultiDexKeep, Shell Script, CassandraQL, RegExp, HiveQL, Smali, Manifest, SHRINKER_CONFIG, JAVA, LogcatFilter, VueJS, IgnoreLang, SQL, $XSLT, PointcutExpression, MariaDB, DB2_IS, AGSL, Oracle, SpEL, SpringDataQL, JSON Lines, FTL], BigQuery, MongoJS, YouTrack, CSS, MongoDB, Metadata JSON, Vertica, SASS, Sybase, ThymeleafIterateExpressions, ThymeleafTemplatesFragmentExpressions, ECMAScript 6, XPath2, HTTP Request, RELAX-NG, DockerIgnore, HttpClientHandlerJavaScriptDialect, FTL, JPAQL, HQL, JShellLanguage, VueTS, MySQL based, MongoDB-JSON, Spring-MongoDB-JSON, Redshift
    }

    override fun getProviderInfo(language: Language, providerId: String): InlayProviderInfo? {
        if (language.id !in LANGUAGE_IDS) {
            return null
        }
        return InlayProviderInfo(
            InlayProvider(),
            providerId,
            emptySet(),
            true,
            "Preview.js",
        )
    }

    override fun getProvidersForLanguage(language: Language): List<InlayProviderInfo> {
        val providerInfo = getProviderInfo(language, "previewjs-${language.id}") ?: return emptyList()
        return listOf(providerInfo)
    }

    override fun getSupportedLanguages(): Set<Language> {
        return (Language.getRegisteredLanguages().filter { l -> LANGUAGE_IDS.contains(l.id) }).toSet()
    }

    class InlayProvider : InlayHintsProvider {
        override fun createCollector(file: PsiFile, editor: Editor): InlayHintsCollector {
            return object: OwnBypassCollector {
                override fun collectHintsForFile(file: PsiFile, sink: InlayTreeSink) {
                    val projectService = file.project.service<ProjectService>()
                    val components = runBlocking {
//                        delay(10000)
                        projectService.computeComponents(file.virtualFile, editor.document)
                    }
                    for (component in components) {
                        val line = StringUtil.countNewLines(file.text.subSequence(0, component.start))
                        val os = System.getProperty("os.name").lowercase()
                        val key = if (os.contains("mac")) "cmd" else "ctrl"
                        sink.addPresentation(
                            EndOfLinePosition(line),
                            hasBackground = true
                        ) {
                            text("Preview (${key}+click)", InlayActionData(StringInlayActionPayload(component.componentId), "com.previewjs.inlays.handler"))
                        }
                    }
                }


            }
        }
    }
}
