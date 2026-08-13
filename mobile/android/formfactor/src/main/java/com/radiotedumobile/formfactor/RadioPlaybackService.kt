package com.radiotedumobile.formfactor

import android.content.Intent
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

class RadioPlaybackService : MediaSessionService() {
    private lateinit var player: ExoPlayer
    private lateinit var mediaSession: MediaSession
    private var currentChannel: RadioChannel? = null
    private var currentUrlIndex = 0

    override fun onCreate() {
        super.onCreate()
        player = ExoPlayer.Builder(this).build().apply {
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .setUsage(C.USAGE_MEDIA)
                    .build(),
                true,
            )
            repeatMode = Player.REPEAT_MODE_ONE
            addListener(
                object : Player.Listener {
                    override fun onPlayerError(error: PlaybackException) {
                        val channel = currentChannel ?: return
                        if (currentUrlIndex + 1 < channel.urls.size) {
                            currentUrlIndex += 1
                            playCurrentUrl()
                        }
                    }
                },
            )
        }
        mediaSession = MediaSession.Builder(this, player).build()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_PLAY) {
            val channelId = intent.getStringExtra(EXTRA_CHANNEL_ID)
            RadioChannels.all.firstOrNull { it.id == channelId }?.let { channel ->
                currentChannel = channel
                currentUrlIndex = 0
                playCurrentUrl()
            }
        }
        return super.onStartCommand(intent, flags, startId)
    }

    private fun playCurrentUrl() {
        val channel = currentChannel ?: return
        val url = channel.urls.getOrNull(currentUrlIndex) ?: return
        player.setMediaItem(
                    MediaItem.Builder()
                        .setMediaId(channel.id)
                        .setUri(url)
                        .setMediaMetadata(
                            MediaMetadata.Builder()
                                .setTitle(channel.title)
                                .setArtist("RadioTEDU")
                                .setIsBrowsable(false)
                                .setIsPlayable(true)
                                .build(),
                        )
                        .build(),
                )
                player.prepare()
                player.play()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession =
        mediaSession

    override fun onDestroy() {
        mediaSession.release()
        player.release()
        super.onDestroy()
    }

    companion object {
        const val ACTION_PLAY = "com.radiotedumobile.action.PLAY_CHANNEL"
        const val EXTRA_CHANNEL_ID = "channel_id"
    }
}
