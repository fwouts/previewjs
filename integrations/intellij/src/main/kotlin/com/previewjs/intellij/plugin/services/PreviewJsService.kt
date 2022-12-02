package com.previewjs.intellij.plugin.services

import com.intellij.execution.process.OSProcessUtil
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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.actor
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.BufferedReader
import java.io.IOException
import java.io.InputStream
import java.io.InputStreamReader
import java.net.ConnectException
import java.net.ServerSocket
import java.net.SocketTimeoutException
import java.util.Collections
import java.util.WeakHashMap
import kotlin.concurrent.thread

const val PLUGIN_ID = "com.previewjs.intellij.plugin"
const val PACKAGE_NAME = "@previewjs/pro"

@Service
class PreviewJsSharedService : Disposable {
    companion object {
        const val SHOWED_WELCOME_SCREEN_KEY = "com.previewjs.showed-welcome-screen"
    }

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
        var errorCount = 0
        val notificationGroup = NotificationGroupManager.getInstance().getNotificationGroup("Preview.js")
        for (msg in channel) {
            try {
                if (serverProcess == null) {
                    api = runServer(msg.project)
                }
                openDocsForFirstUsage()
            } catch (e: NodeVersionError) {
                notificationGroup.createNotification(
                    "Incompatible Node.js version",
                    e.message,
                    NotificationType.ERROR
                )
                    .notify(msg.project)
                return@actor
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

    private fun readInputStream(inputStream: InputStream): String {
        val reader = BufferedReader(InputStreamReader(inputStream))
        val builder = StringBuilder()
        var line: String?
        while (reader.readLine().also { line = it } != null) {
            builder.append(line + "\n")
        }
        val output = builder.toString()
        return cleanStdOut(output)
    }

    private fun cleanStdOut(str: String): String {
        // Important: because we use an interactive login shell, the stream may contain some other logging caused by
        // sourcing scripts. For example:
        // ]697;DoneSourcing]697;DoneSourcingmissing
        // We ignore anything before the last BEL character (07).
        // We also remove escape sequences used e.g. for coloring, see https://stackoverflow.com/a/25189932.
        return str.split("\u0007").last().replace("\\e\\[[\\d;]*[^\\d;]".toRegex(), "")
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
        val nodeVersionProcess = processBuilder("node --version", useWsl = false).directory(nodeDirPath.toFile()).start()
        var useWsl = false
        try {
            if (nodeVersionProcess.waitFor() !== 0) {
                throw Error("Preview.js was unable to run node.\\n\\nIs it installed? You may need to restart your IDE.")
            }
            checkNodeVersion(nodeVersionProcess)
        } catch (e: Error) {
            // Unable to start Node. Check WSL if we're on Windows.
            if (!isWindows()) {
                throw e
            }
            val nodeVersionProcessWsl = processBuilder("node --version", useWsl = true).directory(nodeDirPath.toFile()).start()
            if (nodeVersionProcessWsl.waitFor() === 0) {
                checkNodeVersion(nodeVersionProcessWsl)
                useWsl = true
            } else {
                // If WSL failed, just ignore it.
                throw e
            }
        }
        val builder = processBuilder("node --trace-warnings dist/main.js $port", useWsl)
            .redirectErrorStream(true)
            .directory(nodeDirPath.toFile())
        val process = builder.start()
        serverProcess = process
        val serverOutputReader = BufferedReader(InputStreamReader(process.inputStream))
        thread {
            var line: String? = null
            while (!disposed && serverOutputReader.readLine().also { line = it } != null) {
                for (p in workspaceIds.keys + setOf(project)) {
                    if (p.isDisposed) {
                        continue
                    }
                    p.service<ProjectService>().printToConsole(cleanStdOut(line + "\n"))
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

    private fun checkNodeVersion(process: Process) {
        val nodeVersion = readInputStream(process.inputStream)
        val matchResult = "v(\\d+)\\.(\\d+)".toRegex().find(nodeVersion)
        matchResult?.let {
            val majorVersion = matchResult.groups[1]!!.value.toInt()
            val minorVersion = matchResult.groups[2]!!.value.toInt()
            // Minimum version: 14.18.0.
            if (majorVersion < 14 || majorVersion === 14 && minorVersion < 18) {
                throw NodeVersionError("Preview.js needs NodeJS 14.18.0+ to run, but current version is: ${nodeVersion}\n\nPlease upgrade then restart your IDE.")
            }
        }
    }

    private fun processBuilder(command: String, useWsl: Boolean): ProcessBuilder {
        return if (isWindows()) {
            if (useWsl) {
                ProcessBuilder(
                    "wsl",
                    "bash",
                    "-lic",
                    command
                )
            } else {
                ProcessBuilder(
                    "cmd.exe",
                    "/C",
                    command
                )
            }
        } else {
            // Note: in production builds of IntelliJ / WebStorm, PATH is not initialised
            // from the shell. This means that /usr/local/bin or nvm paths may not be
            // present. This is why we start an interactive login shell.
            val shell = System.getenv()["SHELL"] ?: "bash"
            val builder = ProcessBuilder(shell, "-lic", command)
            builder.environment()["TERM"] = "xterm" // needed for fish
            return builder
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
        serverProcess?.let {
            OSProcessUtil.killProcessTree(it)
        }
        disposed = true
    }

    private fun isWindows() = System.getProperty("os.name").lowercase().contains("win")
}

class NodeVersionError(override val message: String) : Exception(message)
