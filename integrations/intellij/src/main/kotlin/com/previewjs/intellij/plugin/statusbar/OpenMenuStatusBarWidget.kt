package com.previewjs.intellij.plugin.statusbar

import com.intellij.openapi.ui.popup.JBPopup
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget

class OpenMenuStatusBarWidget(
    private val url: String,
    private val onStop: () -> Unit,
    private val onOpenBrowser: () -> Unit,
) : StatusBarWidget {
    companion object {
        const val ID = "previewjs.open-menu"
    }

    override fun ID(): String = ID

    override fun getPresentation(): StatusBarWidget.WidgetPresentation {
        return object : StatusBarWidget.MultipleTextValuesPresentation {
            override fun getPopup(): JBPopup {
                // Note: additional spaces are intentional because IntelliJ doesn't add any padding
                // around each option in the popup chooser. It's ugly as.
                val stopServerPick = " Stop Preview.js server "
                val openExternalBrowserPick = " Open in external browser "
                return JBPopupFactory.getInstance().createPopupChooserBuilder(
                    listOf(
                        stopServerPick,
                        openExternalBrowserPick,
                    ),
                ).setItemChosenCallback { pick ->
                    if (pick == stopServerPick) {
                        onStop()
                    } else {
                        onOpenBrowser()
                    }
                }
                    .createPopup()
            }

            override fun getSelectedValue(): String {
                return "🟢 Preview.js running at $url"
            }

            override fun getTooltipText(): String? {
                return null
            }
        }
    }

    override fun install(statusBar: StatusBar) {
        // Nothing to do.
    }

    override fun dispose() {
        // Nothing to do.
    }
}
