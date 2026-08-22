package com.radiotedumobile.car

import org.junit.Assert.assertFalse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CarVoiceQueryPolicyTest {

    @Test
    fun brandedLatestPodcastPhrasesMatchAcrossSupportedLanguages() {
        val phrases = listOf(
            "Play the latest RadioTEDU podcast",
            "En son RadioTEDU podcast",
            "Последний RadioTEDU подкаст",
            "أحدث RadioTEDU بودكاست",
            "Neuester RadioTEDU Podcast",
            "Dernier podcast RadioTEDU",
        )

        phrases.forEach { phrase ->
            assertTrue(phrase, CarVoiceQueryPolicy.isLatestPodcastQuery(phrase))
        }
    }

    @Test
    fun unrelatedRadioAndEmptyQueriesDoNotBecomePodcastRequests() {
        assertFalse(CarVoiceQueryPolicy.isLatestPodcastQuery("Play RadioTEDU live"))
        assertFalse(CarVoiceQueryPolicy.isLatestPodcastQuery(""))
    }

    @Test
    fun specificStationAliasOutranksGenericRadioTeduAlias() {
        val stationIds = listOf("radiotedu-main", "radiotedu-jazz", "radiotedu-lofi")

        assertEquals(
            "radiotedu-jazz",
            CarVoiceQueryPolicy.bestStationAlias("Play RadioTEDU Jazz", stationIds),
        )
        assertEquals(
            "radiotedu-lofi",
            CarVoiceQueryPolicy.bestStationAlias("Play RadioTEDU Lo-Fi", stationIds),
        )
        assertEquals(
            "radiotedu-main",
            CarVoiceQueryPolicy.bestStationAlias("Play RadioTEDU", stationIds),
        )
    }
}
