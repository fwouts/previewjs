package com.previewjs.intellij.plugin.services

import com.intellij.execution.process.OSProcessUtil
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.project.Project
import com.previewjs.intellij.plugin.api.PreviewJsApi
import com.previewjs.intellij.plugin.api.api
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.actor
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.BufferedReader
import java.io.IOException
import java.io.InputStream
import java.io.InputStreamReader
import java.net.ServerSocket
import java.util.Collections
import java.util.Timer
import java.util.TimerTask
import java.util.WeakHashMap

const val PLUGIN_ID = "com.previewjs.intellij.plugin"
const val PING_INTERVAL_MILLIS = 1000L

@Service(Service.Level.APP)
class PreviewJsSharedService : Disposable {
    private val coroutineContext = SupervisorJob() + Dispatchers.IO
    private val coroutineScope = CoroutineScope(coroutineContext)

    private val app = ApplicationManager.getApplication()
    private val notificationGroup = NotificationGroupManager.getInstance().getNotificationGroup("Preview.js")
    private val plugin = PluginManagerCore.getPlugin(PluginId.getId(PLUGIN_ID))!!
    private val nodeDirPath = plugin.pluginPath.resolve("daemon")
    private var daemonProcess: Process? = null
    private var workspaceIds = Collections.synchronizedMap(WeakHashMap<Project, MutableSet<String>>())

    @Volatile
    private var disposed = false
    private var api: PreviewJsApi? = null
    private var pingTimer: Timer? = null

    data class Message(
        val project: Project,
        val fn: suspend CoroutineScope.(api: PreviewJsApi) -> Unit,
        val getErrorMessage: (e: Throwable) -> String
    )

    @OptIn(ObsoleteCoroutinesApi::class)
    private var actor = coroutineScope.actor<Message> {
        var errorCount = 0
        for (msg in channel) {
            val api = initializeApi(msg.project)
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

    private suspend fun initializeApi(project: Project): PreviewJsApi {
        api?.let {
            return it
        }
        try {
            val api = startDaemon(project)
            this.api = api
            return api
        } catch (e: NodeVersionError) {
            notificationGroup.createNotification(
                "Incompatible Node.js version",
                e.message,
                NotificationType.ERROR
            )
                .notify(project)
            throw e
        } catch (e: Throwable) {
            notificationGroup.createNotification(
                "Preview.js crashed",
                """Please report this issue at https://github.com/fwouts/previewjs/issues

${e.stackTraceToString()}""",
                NotificationType.ERROR
            )
                .notify(project)
            throw e
        }
    }

    fun enqueueAction(
        project: Project,
        fn: suspend CoroutineScope.(api: PreviewJsApi) -> Unit,
        getErrorMessage: (e: Throwable) -> String
    ): Job {
        return coroutineScope.launch {
            actor.send(Message(project, fn, getErrorMessage))
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

    private suspend fun startDaemon(project: Project): PreviewJsApi {
        val port: Int
        try {
            ServerSocket(0).use { serverSocket ->
                port = serverSocket.localPort
            }
        } catch (e: IOException) {
            throw Error("No port is available to run Preview.js daemon")
        }
        val nodeVersionProcess =
            processBuilder("node --version", useWsl = false).directory(nodeDirPath.toFile()).start()
        var useWsl = false
        try {
            if (nodeVersionProcess.waitFor() != 0) {
                throw Error("Preview.js was unable to run node.\\n\\nIs it installed? You may need to restart your IDE.")
            }
            checkNodeVersion(nodeVersionProcess)
        } catch (e: Error) {
            // Unable to start Node. Check WSL if we're on Windows.
            if (!isWindows()) {
                throw e
            }
            val nodeVersionProcessWsl =
                processBuilder("node --version", useWsl = true).directory(nodeDirPath.toFile()).start()
            if (nodeVersionProcessWsl.waitFor() == 0) {
                checkNodeVersion(nodeVersionProcessWsl)
                useWsl = true
            } else {
                // If WSL failed, just ignore it.
                throw e
            }
        }
        val builder = processBuilder("node --trace-warnings dist/main.js $port", useWsl).redirectErrorStream(true)
            .directory(nodeDirPath.toFile())
        val process = builder.start()
        daemonProcess = process
        val daemonOutputReader = BufferedReader(InputStreamReader(process.inputStream))
        val ready = CompletableDeferred<Unit>()
        coroutineScope.launch {
            while (!disposed) {
                while (!daemonOutputReader.ready()) {
                    if (!process.isAlive) {
                        throw Error("Daemon process died")
                    }
                    delay(100)
                }
                val line = daemonOutputReader.readLine() ?: break
                if (line.contains("[install:begin]")) {
                    notificationGroup.createNotification(
                        "⏳ Installing Preview.js dependencies...",
                        NotificationType.INFORMATION
                    ).notify(project)
                }
                if (line.contains("[install:end]")) {
                    notificationGroup.createNotification(
                        "✅ Preview.js dependencies installed",
                        NotificationType.INFORMATION
                    ).notify(project)
                }
                if (line.contains("[ready]")) {
                    ready.complete(Unit)
                }
                everyProject(project) {
                    printToConsole(cleanStdOut(line + "\n"))
                }
            }
        }
        ready.await()

        val client = api("http://localhost:$port")
        pingTimer = Timer()
        pingTimer?.scheduleAtFixedRate(
            object : TimerTask() {
                override fun run() {
                    if (!process.isAlive) {
                        val exitCode = process.exitValue()
                        app.invokeLater {
                            pingTimer?.cancel()
                            pingTimer = null
                            api = null
                            daemonProcess = null
                            everyProject(project) {
                                printToConsole("Preview.js daemon is no longer running (exit code $exitCode). Was it killed?\n")
                                closePreview(processKilled = true)
                            }
                            workspaceIds.clear()
                        }
                    }
                }
            },
            0,
            PING_INTERVAL_MILLIS
        )

        return client
    }

    private fun everyProject(project: Project, f: ProjectService.() -> Unit) {
        for (p in workspaceIds.keys + setOf(project)) {
            if (p.isDisposed) {
                continue
            }
            f(p.service<ProjectService>())
        }
    }

    private fun checkNodeVersion(process: Process) {
        val nodeVersion = readInputStream(process.inputStream)
        val matchResult = "v(\\d+)\\.(\\d+)".toRegex().find(nodeVersion)
        matchResult?.let {
            val majorVersion = matchResult.groups[1]!!.value.toInt()
            val minorVersion = matchResult.groups[2]!!.value.toInt()
            // Minimum version: 16.14.0.
            if (majorVersion < 16 || majorVersion == 16 && minorVersion < 14) {
                throw NodeVersionError("Preview.js needs NodeJS 16.14.0+ to run, but current version is: ${nodeVersion}\n\nPlease upgrade then restart your IDE.")
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

    override fun dispose() {
        pingTimer?.cancel()
        daemonProcess?.let {
            OSProcessUtil.killProcessTree(it)
        }
        disposed = true
    }

    private fun isWindows() = System.getProperty("os.name").lowercase().contains("win")
}

class NodeVersionError(override val message: String) : Exception(message)
