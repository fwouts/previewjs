package com.previewjs.intellij.plugin.services

import com.intellij.ide.BrowserUtil
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.ide.util.PropertiesComponent
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.project.Project
import com.previewjs.intellij.plugin.api.DisposeWorkspaceRequest
import com.previewjs.intellij.plugin.api.GetWorkspaceRequest
import com.previewjs.intellij.plugin.api.PreviewJsApi
import com.previewjs.intellij.plugin.api.api
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.actor
import java.io.BufferedReader
import java.io.IOException
import java.io.InputStream
import java.io.InputStreamReader
import java.net.ConnectException
import java.net.ServerSocket
import java.net.SocketTimeoutException
import java.util.*
import kotlin.concurrent.thread


const val PLUGIN_ID = "com.previewjs.intellij.plugin"
const val PACKAGE_NAME = "@previewjs/pro"

@Service
class PreviewJsSharedService : Disposable {
    companion object {
        const val SHOWED_WELCOME_SCREEN_KEY = "com.previewjs.showed-welcome-screen"
    }

    @OptIn(ObsoleteCoroutinesApi::class)
    private val coroutineContext = SupervisorJob() + Dispatchers.IO
    private val coroutineScope = CoroutineScope(coroutineContext)

    private val plugin = PluginManagerCore.getPlugin(PluginId.getId(PLUGIN_ID))!!
    private val nodeDirPath = plugin.pluginPath.resolve("controller")
    private val properties = PropertiesComponent.getInstance()
    private var serverProcess: Process? = null
    private var workspaceIds = Collections.synchronizedMap(WeakHashMap<Project, MutableSet<String>>())

    @Volatile
    private var disposed = false
    private lateinit var api: PreviewJsApi

    data class Message(
        val project: Project,
        val fn: suspend CoroutineScope.(api: PreviewJsApi) -> Unit,
        val getErrorMessage: (e: Throwable) -> String
    )

    @OptIn(ObsoleteCoroutinesApi::class)
    private var actor = coroutineScope.actor<Message> {
        var installChecked = false
        var errorCount = 0
        val notificationGroup = NotificationGroupManager.getInstance().getNotificationGroup("Preview.js")
        for (msg in channel) {
            try {
                if (!installChecked) {
                    if (!isInstalled()) {
                        install(msg.project)
                    }
                    installChecked = true
                }
                if (serverProcess == null) {
                    api = runServer(msg.project)
                }
                openDocsForFirstUsage()
            } catch (e: Throwable) {
                notificationGroup.createNotification(
                    "Preview.js crashed",
                    """Please report this issue at https://github.com/fwouts/previewjs/issues

${e.stackTraceToString()}""",
                    NotificationType.ERROR
                )
                    .notify(msg.project)
                return@actor
            }
            try {
                (msg.fn)(api)
            } catch (e: Throwable) {
                val errorMessage = (msg.getErrorMessage)(e)
                msg.project.service<ProjectService>().printToConsole("$errorMessage\n\n${e.stackTraceToString()}\n")
                errorCount += 1
                if (errorCount > 10) {
                    // Something must be seriously wrong, abort.
                    notificationGroup.createNotification(
                        "Preview.js tasks are failing repeatedly",
                        """Please report this issue at https://github.com/fwouts/previewjs/issues

Include the content of the Preview.js logs panel for easier debugging.
                        """.trimMargin(),
                        NotificationType.ERROR
                    )
                        .notify(msg.project)
                    return@actor
                }
            }
        }
    }

    fun enqueueAction(
        project: Project,
        fn: suspend CoroutineScope.(api: PreviewJsApi) -> Unit,
        getErrorMessage: (e: Throwable) -> String
    ) {
        coroutineScope.launch {
            actor.send(Message(project, fn, getErrorMessage))
        }
    }

    private fun openDocsForFirstUsage() {
        if (properties.getValue(SHOWED_WELCOME_SCREEN_KEY) != "1") {
            properties.setValue(SHOWED_WELCOME_SCREEN_KEY, "1")
            BrowserUtil.browse("https://previewjs.com/docs")
        }
    }

    private fun isInstalled(): Boolean {
        val builder = processBuilder("node dist/is-installed.js")
            .directory(nodeDirPath.toFile())
        val process = builder.start()
        if (process.waitFor() != 0) {
            throw Error(readInputStream(process.errorStream))
        }
        val output = readInputStream(process.inputStream)
        return when (val result = output.split("\n").last { x -> x.isNotEmpty() }.split(" ").last()) {
            "installed" -> true
            "missing" -> false
            else -> throw Error("Unexpected output: $result")
        }
    }

    private fun readInputStream(inputStream: InputStream): String {
        val reader = BufferedReader(InputStreamReader(inputStream))
        val builder = StringBuilder()
        var line: String?
        while (reader.readLine().also { line = it } != null) {
            builder.append(line + "\n")
        }
        val output = builder.toString()
        return ignoreBellPrefix(output)
    }

    private fun ignoreBellPrefix(str: String): String {
        // Important: because we use an interactive login shell, the stream may contain some other logging caused by
        // sourcing scripts. For example:
        // ]697;DoneSourcing]697;DoneSourcingmissing
        // We ignore anything before the last BEL character (07).
        return str.split("\u0007").last()
    }

    private fun install(project: Project) {
        val builder = processBuilder("node dist/install.js")
            .directory(nodeDirPath.toFile())
        val process = builder.start()
        val reader = BufferedReader(InputStreamReader(process.inputStream))
        val projectService = project.service<ProjectService>()
        projectService.showConsole()
        var line: String?
        while (reader.readLine().also { line = it } != null) {
            projectService.printToConsole(ignoreBellPrefix(line + "\n"))
        }
        if (process.waitFor() != 0) {
            throw Error(readInputStream(process.errorStream))
        }
    }

    private suspend fun runServer(project: Project): PreviewJsApi {
        val port: Int
        try {
            ServerSocket(0).use { serverSocket ->
                port = serverSocket.localPort
            }
        } catch (e: IOException) {
            throw Error("No port is not available to run Preview.js controller")
        }
        val builder = processBuilder("node dist/run-server.js")
            .redirectErrorStream(true)
            .directory(nodeDirPath.toFile())
        builder.environment()["PORT"] = "$port"
        builder.environment()["PREVIEWJS_INTELLIJ_VERSION"] = plugin.version
        builder.environment()["PREVIEWJS_PACKAGE_NAME"] = PACKAGE_NAME
        val process = builder.start()
        serverProcess = process
        val serverOutputReader = BufferedReader(InputStreamReader(process.inputStream))
        thread {
            var line: String? = null
            while (!disposed && serverOutputReader.readLine().also { line = it } != null) {
                for (project in workspaceIds.keys + setOf(project)) {
                    if (project.isDisposed) {
                        continue
                    }
                    project.service<ProjectService>().printToConsole(ignoreBellPrefix(line + "\n"))
                }
            }
        }
        val api = api("http://localhost:$port")
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
            // 10 seconds wait in total (100 * 100ms).
            delay(100)
            if (attempts > 100) {
                throw Error("Preview.js controller failed to start.")
            }
        }
        return api
    }

    private fun processBuilder(command: String): ProcessBuilder {
        return if (System.getProperty("os.name").lowercase().contains("win")) {
            ProcessBuilder(
                "cmd.exe",
                "/C",
                command
            )
        } else {
            // Note: in production builds of IntelliJ / WebStorm, PATH is not initialised
            // from the shell. This means that /usr/local/bin or nvm paths may not be
            // present. This is why we start an interactive login shell.
            return ProcessBuilder(System.getenv()["SHELL"] ?: "bash", "-cil", command)
        }
    }

    suspend fun ensureWorkspaceReady(project: Project, absoluteFilePath: String): String? {
        val workspaceId = api.getWorkspace(
            GetWorkspaceRequest(
                absoluteFilePath = absoluteFilePath
            )
        ).workspaceId ?: return null
        var ids = workspaceIds[project]
        if (ids == null) {
            ids = Collections.synchronizedSet(mutableSetOf())
            workspaceIds[project] = ids
            project.service<ProjectService>().printToConsole("Preview.js initialised for project ${project.name}\n")
        }
        ids!!.add(workspaceId)
        return workspaceId
    }

    suspend fun disposeWorkspaces(project: Project) {
        val workspaceIdsToDisposeOf = workspaceIds[project].orEmpty().toMutableSet()
        workspaceIds.remove(project)
        for (otherProjectWorkspaceIds in workspaceIds.values) {
            workspaceIdsToDisposeOf.removeAll(otherProjectWorkspaceIds)
        }
        for (workspaceId in workspaceIdsToDisposeOf) {
            api.disposeWorkspace(DisposeWorkspaceRequest(workspaceId))
        }
    }

    override fun dispose() {
        serverProcess?.destroy()
        disposed = true
    }
}