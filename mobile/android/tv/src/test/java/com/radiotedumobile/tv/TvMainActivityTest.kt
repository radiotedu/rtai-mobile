package com.radiotedumobile.tv

import android.view.View
import android.view.ViewGroup
import android.widget.Button
import com.radiotedumobile.formfactor.RadioChannels
import com.radiotedumobile.formfactor.RadioPlaybackService
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class TvMainActivityTest {
    @Test
    fun rendersDpadChannelsAndStartsPlaybackService() {
        val activity = Robolectric.buildActivity(TvMainActivity::class.java).setup().get()
        val buttons = buttonsIn(activity.findViewById(android.R.id.content))

        assertEquals(RadioChannels.all.map { it.title }, buttons.map { it.text.toString() })
        assertTrue(buttons.all { it.isFocusable })
        assertTrue(buttons.first().isFocused)

        buttons.first().performClick()
        val intent = shadowOf(activity).nextStartedService
        assertEquals(RadioPlaybackService.ACTION_PLAY, intent.action)
        assertEquals(RadioChannels.all.first().id, intent.getStringExtra(RadioPlaybackService.EXTRA_CHANNEL_ID))
        assertEquals(RadioPlaybackService::class.java.name, intent.component?.className)
    }

    private fun buttonsIn(view: View): List<Button> = when (view) {
        is Button -> listOf(view)
        is ViewGroup -> (0 until view.childCount).flatMap { buttonsIn(view.getChildAt(it)) }
        else -> emptyList()
    }
}
