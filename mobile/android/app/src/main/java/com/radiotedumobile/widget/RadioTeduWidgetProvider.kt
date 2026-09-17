package com.radiotedumobile.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import com.radiotedumobile.MainActivity
import com.radiotedumobile.R

class RadioTeduWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_PLAY_PAUSE = "com.radiotedumobile.ACTION_WIDGET_PLAY_PAUSE"
        const val ACTION_NEXT_STATION = "com.radiotedumobile.ACTION_WIDGET_NEXT_STATION"
        const val ACTION_PREV_STATION = "com.radiotedumobile.ACTION_WIDGET_PREV_STATION"
        const val ACTION_UPDATE_DATA = "com.radiotedumobile.ACTION_WIDGET_UPDATE_DATA"

        const val EXTRA_STATION = "extra_station"
        const val EXTRA_TRACK = "extra_track"
        const val EXTRA_IS_PLAYING = "extra_is_playing"

        var cachedStation: String = "RadioTEDU"
        var cachedTrack: String = "TED Üniversitesi Radyosu"
        var cachedIsPlaying: Boolean = false

        fun updateAllWidgets(
            context: Context,
            station: String = cachedStation,
            track: String = cachedTrack,
            isPlaying: Boolean = cachedIsPlaying
        ) {
            cachedStation = station
            cachedTrack = track
            cachedIsPlaying = isPlaying

            val appWidgetManager = AppWidgetManager.getInstance(context) ?: return
            val componentName = ComponentName(context, RadioTeduWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName) ?: return

            for (appWidgetId in appWidgetIds) {
                buildAndApplyRemoteViews(context, appWidgetManager, appWidgetId, station, track, isPlaying)
            }
        }

        private fun buildAndApplyRemoteViews(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
            station: String,
            track: String,
            isPlaying: Boolean
        ) {
            val views = RemoteViews(context.packageName, R.layout.radio_tedu_app_widget)

            views.setTextViewText(R.id.tv_widget_station, station)
            views.setTextViewText(R.id.tv_widget_track, track)

            val playIcon = if (isPlaying) {
                android.R.drawable.ic_media_pause
            } else {
                android.R.drawable.ic_media_play
            }
            views.setImageViewResource(R.id.btn_widget_play, playIcon)

            val flag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            // Launch MainActivity when tapping the card or logo
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val launchPendingIntent = PendingIntent.getActivity(context, 0, launchIntent, flag)
            views.setOnClickPendingIntent(R.id.widget_container, launchPendingIntent)
            views.setOnClickPendingIntent(R.id.iv_widget_logo, launchPendingIntent)

            // Play / Pause intent
            val playIntent = Intent(context, RadioTeduWidgetProvider::class.java).apply {
                action = ACTION_PLAY_PAUSE
            }
            val playPendingIntent = PendingIntent.getBroadcast(context, 101, playIntent, flag)
            views.setOnClickPendingIntent(R.id.btn_widget_play, playPendingIntent)

            // Prev station intent
            val prevIntent = Intent(context, RadioTeduWidgetProvider::class.java).apply {
                action = ACTION_PREV_STATION
            }
            val prevPendingIntent = PendingIntent.getBroadcast(context, 102, prevIntent, flag)
            views.setOnClickPendingIntent(R.id.btn_widget_prev, prevPendingIntent)

            // Next station intent
            val nextIntent = Intent(context, RadioTeduWidgetProvider::class.java).apply {
                action = ACTION_NEXT_STATION
            }
            val nextPendingIntent = PendingIntent.getBroadcast(context, 103, nextIntent, flag)
            views.setOnClickPendingIntent(R.id.btn_widget_next, nextPendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            buildAndApplyRemoteViews(
                context,
                appWidgetManager,
                appWidgetId,
                cachedStation,
                cachedTrack,
                cachedIsPlaying
            )
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        when (intent.action) {
            ACTION_UPDATE_DATA -> {
                val station = intent.getStringExtra(EXTRA_STATION) ?: cachedStation
                val track = intent.getStringExtra(EXTRA_TRACK) ?: cachedTrack
                val isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, cachedIsPlaying)
                updateAllWidgets(context, station, track, isPlaying)
            }
            ACTION_PLAY_PAUSE -> {
                // Forward command to React Native / MediaSession via system broadcast
                val forwardIntent = Intent("com.radiotedumobile.WIDGET_COMMAND").apply {
                    setPackage(context.packageName)
                    putExtra("command", "toggle_play")
                }
                context.sendBroadcast(forwardIntent)

                // Optimistically toggle play state in widget UI
                cachedIsPlaying = !cachedIsPlaying
                updateAllWidgets(context, cachedStation, cachedTrack, cachedIsPlaying)
            }
            ACTION_NEXT_STATION -> {
                val forwardIntent = Intent("com.radiotedumobile.WIDGET_COMMAND").apply {
                    setPackage(context.packageName)
                    putExtra("command", "next_station")
                }
                context.sendBroadcast(forwardIntent)
            }
            ACTION_PREV_STATION -> {
                val forwardIntent = Intent("com.radiotedumobile.WIDGET_COMMAND").apply {
                    setPackage(context.packageName)
                    putExtra("command", "prev_station")
                }
                context.sendBroadcast(forwardIntent)
            }
        }
    }
}
