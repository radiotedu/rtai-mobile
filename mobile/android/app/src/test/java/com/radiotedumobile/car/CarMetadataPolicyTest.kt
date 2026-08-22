package com.radiotedumobile.car

import org.junit.Assert.assertEquals
import org.junit.Test

class CarMetadataPolicyTest {

    private val icySong = CarMetadataText(title = "Song", artist = "Artist")

    @Test
    fun lowAndNormalLofiReplaceIcyWithStationIdentity() {
        for (quality in listOf("low", "normal")) {
            assertEquals(
                CarMetadataText(title = "RadioTEDU Lo-Fi", artist = null),
                CarMetadataPolicy.sanitizeIcy(
                    mediaId = "radiotedu-lofi",
                    quality = quality,
                    stationTitle = "RadioTEDU Lo-Fi",
                    incoming = icySong,
                ),
            )
        }
    }

    @Test
    fun flacOrOtherStationsKeepIncomingIcyForNormalization() {
        assertEquals(
            icySong,
            CarMetadataPolicy.sanitizeIcy(
                mediaId = "radiotedu-lofi",
                quality = "flac",
                stationTitle = "RadioTEDU Lo-Fi",
                incoming = icySong,
            ),
        )
        assertEquals(
            icySong,
            CarMetadataPolicy.sanitizeIcy(
                mediaId = "radiotedu-jazz",
                quality = "normal",
                stationTitle = "RadioTEDU Jazz",
                incoming = icySong,
            ),
        )
    }
}
