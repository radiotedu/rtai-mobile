package com.radiotedumobile.notifications

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NotificationBridgeModule(context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {
    override fun getName() = "RadioTeduNotificationBridge"

    @ReactMethod
    fun scheduleListeningReminder(title: String, body: String) {
        ListeningReminderScheduler.schedule(reactApplicationContext, title, body)
    }

    @ReactMethod
    fun updateListeningReminderText(title: String, body: String) {
        ListeningReminderScheduler.updateText(reactApplicationContext, title, body)
    }
}
