package com.radiotedumobile.live

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.radiotedumobile.MainActivity
import com.radiotedumobile.R

class LiveVoteBridgeModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

    override fun getName(): String = "RadioTeduLiveVoteBridge"

    @ReactMethod
    fun update(roundId: String, title: String, startedAtMs: Double, endsAtMs: Double) {
        if (Build.VERSION.SDK_INT < 36 || roundId.isBlank()) return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val started = startedAtMs.toLong()
        val ends = endsAtMs.toLong()
        val duration = (ends - started).coerceAtLeast(1L)
        val elapsed = (System.currentTimeMillis() - started).coerceIn(0L, duration)
        val progress = ((elapsed * 100L) / duration).toInt()
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Canlı Voting", NotificationManager.IMPORTANCE_DEFAULT),
        )
        val openVoting = PendingIntent.getActivity(
            context,
            0,
            Intent(Intent.ACTION_VIEW, android.net.Uri.parse("radiotedu://voting"), context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val style = Notification.ProgressStyle()
            .setStyledByProgress(true)
            .setProgress(progress)
            .addProgressSegment(Notification.ProgressStyle.Segment(100).setColor(Color.rgb(227, 30, 36)))
        val extras = Bundle().apply {
            // The public constant was added in the Android 36.1 SDK extension.
            // Use its documented stable value so compileSdk 36 builds can opt in;
            // platform 36.1+ consumes it and earlier Android 16 builds ignore it.
            putBoolean(PROMOTED_ONGOING_EXTRA, true)
        }
        val notification = Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.car_tile_charts)
            .setContentTitle(title.ifBlank { "RadioTEDU Voting" })
            .setContentText("Oylama devam ediyor")
            .setContentIntent(openVoting)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setTimeoutAfter((ends - System.currentTimeMillis()).coerceAtLeast(1L))
            .setWhen(ends)
            .setShowWhen(true)
            .setExtras(extras)
            .setStyle(style)
            .build()
        manager.notify(NOTIFICATION_ID, notification)
    }

    @ReactMethod
    fun finish() {
        context.getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
    }

    private companion object {
        const val CHANNEL_ID = "radiotedu_live_vote"
        const val NOTIFICATION_ID = 8842
        const val PROMOTED_ONGOING_EXTRA = "android.requestPromotedOngoing"
    }
}
