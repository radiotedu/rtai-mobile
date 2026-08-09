package com.radiotedumobile.formfactor

data class RadioChannel(val id: String, val title: String, val url: String)

object RadioChannels {
    val all = listOf(
        RadioChannel("radiotedu-main", "RadioTEDU", "https://stream.radiotedu.com/radio"),
        RadioChannel("radiotedu-classic", "Classic", "https://stream.radiotedu.com/classic"),
        RadioChannel("radiotedu-jazz", "Jazz", "https://stream.radiotedu.com/cazz"),
        RadioChannel("radiotedu-lofi", "Lo-Fi", "https://stream.radiotedu.com/lofi"),
        RadioChannel("radiotedu-spark", "rtAI", "https://stream.radiotedu.com/spark"),
        RadioChannel("radiotedu-rock", "Rock", "https://stream.radiotedu.com/rock"),
    )
}
