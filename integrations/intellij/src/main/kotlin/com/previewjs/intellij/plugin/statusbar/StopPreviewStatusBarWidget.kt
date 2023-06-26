package com.previewjs.intellij.plugin.statusbar

import com.intellij.openapi.ui.popup.JBPopup
import com.intellij.openapi.wm.StatusBarWidget

class StopPreviewStatusBarWidget(private val url: String, private val onClick: () -> Unit) : StatusBarWidget {
    companion object {
        const val ID = "previewjs.stop"
    }

    override fun ID(): String = ID

    override fun getPresentation(): StatusBarWidget.WidgetPresentation {
        return object : StatusBarWidget.MultipleTextValuesPresentation {
            override fun getPopup(): JBPopup? {
                onClick()
                return null
            }

            override fun getSelectedValue(): String {
                return "🛑 Preview.js running at $url"
            }

            override fun getTooltipText(): String? {
                return null
            }
        }
    }
}
