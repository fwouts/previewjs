package com.previewjs.intellij.plugin.services

import com.intellij.ide.BrowserUtil
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.ide.util.PropertiesComponent
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.previewjs.intellij.plugin.api.GetWorkspaceRequest
import com.previewjs.intellij.plugin.api.PreviewJsApi
import com.previewjs.intellij.plugin.api.api
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.actor
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.util.*

const val PLUGIN_ID = "com.previewjs.intellij.plugin"

@Service
class PreviewJsSharedService : Disposable {
    companion object {
        const val PORT = 9120
        const val SHOWED_WELCOME_SCREEN_KEY = "com.previewjs.showed-welcome-screen"
    }

    @OptIn(ObsoleteCoroutinesApi::class)
    private val coroutineContext = SupervisorJob() + Dispatchers.IO
    private val coroutineScope = CoroutineScope(coroutineContext)

    private val plugin = PluginManagerCore.getPlugin(PluginId.getId(PLUGIN_ID))!!
    private val nodeDirPath = plugin.pluginPath.resolve("controller")
    private val infoLogFilePath = nodeDirPath.resolve("controller-info.log")
    private val errorLogFilePath = nodeDirPath.resolve("controller-error.log")
    private val properties = PropertiesComponent.getInstance()
    private var npmInstallProcess: Process? = null
    private var controlPlaneProcess: Process? = null
    private var workspaces = WeakHashMap<Project, PreviewJsWorkspace>()
    private lateinit var api: PreviewJsApi

    data class Message(
            val project: Project,
            val fn: suspend CoroutineScope.(workspace: PreviewJsWorkspace) -> Unit
    )

    @OptIn(ObsoleteCoroutinesApi::class)
    private var actor = coroutineScope.actor<Message> {
        for (msg in channel) {
            val projectDirPath = msg.project.basePath ?: continue
            try {
                if (controlPlaneProcess == null) {
                    api = start()
                } else if (controlPlaneProcess?.isAlive == false) {
                    // It crashed, restart it.
                    for (workspace in workspaces.values) {
                        Disposer.dispose(workspace)
                    }
                    workspaces.clear()
                    controlPlaneProcess = null
                    api = start()
                }
                val workspace = ensureWorkspaceReady(msg.project, projectDirPath) ?: continue
                openDocsForFirstUsage()
                (msg.fn)(workspace)
            } catch (e: Throwable) {
                NotificationGroupManager.getInstance().getNotificationGroup("Preview.js")
                        .createNotification(
                                "Preview.js crashed",
                                """Please report this issue at https://github.com/zenclabs/previewjs/issues

See detailed logs in $errorLogFilePath

${e.stackTraceToString()}""",
                                NotificationType.ERROR
                        )
                        .notify(msg.project)
                return@actor
            }
        }
    }

    fun launch(project: Project, fn: suspend CoroutineScope.(workspace: PreviewJsWorkspace) -> Unit) {
        coroutineScope.launch {
            actor.send(Message(project, fn))
        }
    }

    private fun openDocsForFirstUsage() {
        if (properties.getValue(SHOWED_WELCOME_SCREEN_KEY) != "1") {
            properties.setValue(SHOWED_WELCOME_SCREEN_KEY, "1")
            BrowserUtil.browse("https://previewjs.com/docs")
        }
    }

    private suspend fun start(): PreviewJsApi {
        val builder = processBuilder("node dist/index.js")
                .redirectOutput(infoLogFilePath.toFile())
                .redirectError(errorLogFilePath.toFile())
                .directory(nodeDirPath.toFile())
        builder.environment()["PORT"] = "$PORT"
        builder.environment()["PREVIEWJS_INTELLIJ_VERSION"] = plugin.getVersion()
        builder.environment()["PREVIEWJS_PACKAGE_NAME"] = "@previewjs/app"
        builder.environment()["PREVIEWJS_PACKAGE_VERSION"] = "1.0.3"
        println("Preview.js control plane errors will be logged to $errorLogFilePath")
        val process = builder.start()
        controlPlaneProcess = process
        val api = api("http://localhost:$PORT")
        var attempts = 0
        while (true) {
            try {
                if (api.checkHealth().ready) {
                    break
                }
            } catch (e: ConnectException) {
                // Wait.
            } catch (e: SocketTimeoutException) {
                // Wait.
            }
            attempts += 1
            // 60 seconds wait in total (600 * 100).
            delay(100)
            if (attempts > 600) {
                throw Error("Preview.js control plane failed to start.")
            }
        }
        return api
    }

    private fun processBuilder(command: String): ProcessBuilder {
        return if (System.getProperty("os.name").lowercase().contains("win")) {
            ProcessBuilder(
                    "cmd.exe",
                    "/C",
                    command)
        } else {
            // Note: in production builds of IntelliJ / WebStorm, PATH is not initialised
            // from the shell. This means that /usr/local/bin or nvm paths may not be
            // present. This is why we start an interactive login shell.
            return ProcessBuilder(System.getenv()["SHELL"] ?: "bash", "-cil", command)
        }
    }

    private suspend fun ensureWorkspaceReady(project: Project, projectDirPath: String): PreviewJsWorkspace? {
        workspaces[project]?.let { return it }
        val getWorkspaceResponse = api.getWorkspace(
                GetWorkspaceRequest(
                        filePath = projectDirPath
                )
        )
        if (getWorkspaceResponse.workspaceId == null) {
            return null
        }
        val workspace = PreviewJsWorkspace(api, getWorkspaceResponse.workspaceId)
        Disposer.register(this, workspace)
        workspaces[project] = workspace
        return workspace
    }

    override fun dispose() {
        npmInstallProcess?.destroy()
        controlPlaneProcess?.destroy()
    }
}