package com.radiotedumobile.notifications

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.radiotedumobile.MainActivity
import com.radiotedumobile.R
import kotlin.random.Random

object ListeningReminderScheduler {
    private const val PREFS = "radiotedu_listening_reminders"
    private const val KEY_TITLE = "title"
    private const val KEY_BODY = "body"
    private const val REQUEST_CODE = 2106
    private const val MIN_DELAY_DAYS = 4
    private const val MAX_DELAY_DAYS = 7

    fun schedule(context: Context, title: String, body: String) {
        val normalizedTitle = title.trim()
        val normalizedBody = body.trim()
        if (normalizedTitle.isEmpty() || normalizedBody.isEmpty()) return
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_TITLE, normalizedTitle)
            .putString(KEY_BODY, normalizedBody)
            .apply()
        scheduleSaved(context)
    }

    fun updateText(context: Context, title: String, body: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.contains(KEY_TITLE) || !prefs.contains(KEY_BODY)) return
        val normalizedTitle = title.trim()
        val normalizedBody = body.trim()
        if (normalizedTitle.isEmpty() || normalizedBody.isEmpty()) return
        prefs.edit()
            .putString(KEY_TITLE, normalizedTitle)
            .putString(KEY_BODY, normalizedBody)
            .apply()
    }

    fun scheduleSaved(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.contains(KEY_TITLE) || !prefs.contains(KEY_BODY)) return
        val delayDays = Random.nextInt(MIN_DELAY_DAYS, MAX_DELAY_DAYS + 1)
        val triggerAt = System.currentTimeMillis() + delayDays * 24L * 60L * 60L * 1000L
        val intent = Intent(context, ListeningReminderReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
    }

    fun text(context: Context): Pair<String, String>? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val title = prefs.getString(KEY_TITLE, null) ?: return null
        val body = prefs.getString(KEY_BODY, null) ?: return null
        return title to body
    }
}

class ListeningReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val (title, body) = ListeningReminderScheduler.text(context) ?: return
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            notificationManager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "RadioTEDU reminders",
                    NotificationManager.IMPORTANCE_DEFAULT,
                ),
            )
        }
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val contentIntent = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val canNotify = Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        if (canNotify) {
            NotificationManagerCompat.from(context).notify(
                NOTIFICATION_ID,
                NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_launcher_monochrome)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                    .setAutoCancel(true)
                    .setContentIntent(contentIntent)
                    .build(),
            )
        }
        ListeningReminderScheduler.scheduleSaved(context)
    }

    companion object {
        private const val CHANNEL_ID = "radiotedu_listening_reminders"
        private const val NOTIFICATION_ID = 2106
    }
}

class ReminderBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        ListeningReminderScheduler.scheduleSaved(context)
    }
}
