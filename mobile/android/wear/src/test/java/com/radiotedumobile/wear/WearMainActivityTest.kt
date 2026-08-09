package com.radiotedumobile.wear

import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ScrollView
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
class WearMainActivityTest {
    @Test
    fun rendersScrollableChannelsAndStartsPlaybackService() {
        val activity = Robolectric.buildActivity(WearMainActivity::class.java).setup().get()
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        assertTrue(content.getChildAt(0) is ScrollView)
        val buttons = buttonsIn(content)

        assertEquals(RadioChannels.all.map { it.title }, buttons.map { it.text.toString() })

        buttons.last().performClick()
        val intent = shadowOf(activity).nextStartedService
        assertEquals(RadioPlaybackService.ACTION_PLAY, intent.action)
        assertEquals(RadioChannels.all.last().id, intent.getStringExtra(RadioPlaybackService.EXTRA_CHANNEL_ID))
        assertEquals(RadioPlaybackService::class.java.name, intent.component?.className)
    }

    private fun buttonsIn(view: View): List<Button> = when (view) {
        is Button -> listOf(view)
        is ViewGroup -> (0 until view.childCount).flatMap { buttonsIn(view.getChildAt(it)) }
        else -> emptyList()
    }
}
