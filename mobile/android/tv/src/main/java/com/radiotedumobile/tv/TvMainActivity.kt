package com.radiotedumobile.tv

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.TextView
import com.radiotedumobile.formfactor.RadioChannels
import com.radiotedumobile.formfactor.RadioPlaybackService

class TvMainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(48), dp(32), dp(48), dp(32))
            setBackgroundColor(Color.rgb(7, 7, 7))
        }
        content.addView(TextView(this).apply {
            text = "RadioTEDU"
            textSize = 32f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(72)))

        val grid = GridLayout(this).apply {
            columnCount = 3
            rowCount = 2
            alignmentMode = GridLayout.ALIGN_BOUNDS
            useDefaultMargins = true
        }
        RadioChannels.all.forEachIndexed { index, channel ->
            grid.addView(Button(this).apply {
                text = channel.title
                textSize = 20f
                isFocusable = true
                setOnClickListener { play(channel.id) }
                if (index == 0) requestFocus()
            }, GridLayout.LayoutParams().apply {
                width = dp(230)
                height = dp(96)
                setGravity(Gravity.FILL)
            })
        }
        content.addView(grid)
        setContentView(content)
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
