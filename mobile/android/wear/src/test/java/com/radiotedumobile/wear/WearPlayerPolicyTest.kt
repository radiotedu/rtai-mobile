package com.radiotedumobile.wear

import com.radiotedumobile.formfactor.RadioChannels
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WearPlayerPolicyTest {

    @Test
    fun verifyCanonicalChannelsAvailableOnWear() {
        val channels = RadioChannels.all
        assertTrue("Wear OS must have canonical radio channels", channels.isNotEmpty())

        val main = channels.find { it.id == "radiotedu-main" }
        assertNotNull("RadioTEDU flagship station must be present on watch", main)
        assertEquals("RadioTEDU", main?.title)
    }

    @Test
    fun verifyWearAudioStreamsUseHttps() {
        RadioChannels.all.forEach { channel ->
            assertTrue(
                "Wear OS audio stream must be secure HTTPS: ${channel.id}",
                channel.streamUrl.startsWith("https://")
            )
        }
    }
}
