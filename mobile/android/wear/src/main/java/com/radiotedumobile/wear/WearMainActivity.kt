package com.radiotedumobile.wear

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.radiotedumobile.formfactor.RadioChannels
import com.radiotedumobile.formfactor.RadioPlaybackService

class WearMainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val list = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(20), dp(20), dp(20), dp(28))
            setBackgroundColor(Color.rgb(7, 7, 7))
        }
        list.addView(TextView(this).apply {
            text = "RadioTEDU"
            textSize = 20f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)))

        RadioChannels.all.forEach { channel ->
            list.addView(Button(this).apply {
                text = channel.title
                textSize = 15f
                setOnClickListener { play(channel.id) }
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(58)).apply {
                bottomMargin = dp(6)
            })
        }
        setContentView(ScrollView(this).apply { addView(list) })
    }

    private fun play(channelId: String) {
        val intent = Intent(this, RadioPlaybackService::class.java)
            .setAction(RadioPlaybackService.ACTION_PLAY)
            .putExtra(RadioPlaybackService.EXTRA_CHANNEL_ID, channelId)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent)
        else startService(intent)
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
