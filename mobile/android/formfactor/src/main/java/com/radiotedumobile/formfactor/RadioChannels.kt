package com.radiotedumobile.formfactor

data class RadioChannel(
    val id: String,
    val title: String,
    val urls: List<String>,
    val losslessUrl: String? = null,
) {
    val url: String get() = urls.first()
}

object RadioChannels {
    val all = listOf(
        qualityChannel("radiotedu-main", "RadioTEDU", "radio"),
        qualityChannel("radiotedu-classic", "Classic", "classic"),
        qualityChannel("radiotedu-jazz", "Jazz", "cazz"),
        qualityChannel("radiotedu-lofi", "Lo-Fi", "lofi"),
        qualityChannel("radiotedu-energize", "Energize", "energize"),
        RadioChannel("radiotedu-spark", "rtAI", listOf("https://stream.radiotedu.com/spark")),
        qualityChannel("radiotedu-rock", "Rock", "rock"),
        RadioChannel("radiotedu-en", "RadioTEDU English", listOf("https://stream.radiotedu.com/en")),
        RadioChannel("radiotedu-fr", "RadioTEDU Français", listOf("https://stream.radiotedu.com/fr")),
    )

    private fun qualityChannel(id: String, title: String, mount: String): RadioChannel {
        val origin = "https://stream.radiotedu.com"
        val losslessOrigin = "http://stream.radiotedu.com:11154"
        return RadioChannel(
            id,
            title,
            listOf(
                "$origin/$mount-normal",
                "$origin/$mount-low",
                "$origin/$mount-high",
                "$origin/$mount",
            ),
            losslessUrl = "$losslessOrigin/$mount-flac",
        )
    }
}
