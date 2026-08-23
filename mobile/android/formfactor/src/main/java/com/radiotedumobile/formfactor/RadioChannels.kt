package com.radiotedumobile.formfactor

data class RadioChannel(val id: String, val title: String, val url: String)

object RadioChannels {
    val all = listOf(
        RadioChannel("radiotedu-main", "RadioTEDU", "https://stream.radiotedu.com/radio"),
        RadioChannel("radiotedu-classic", "Classic", "https://stream.radiotedu.com/classic"),
        RadioChannel("radiotedu-jazz", "Jazz", "https://stream.radiotedu.com/cazz"),
        RadioChannel("radiotedu-lofi", "Lo-Fi", "https://stream.radiotedu.com/lofi"),
        RadioChannel("radiotedu-energize", "Energize", "https://stream.radiotedu.com/energize"),
        RadioChannel("radiotedu-rock", "Rock", "https://stream.radiotedu.com/rock"),
        RadioChannel("radiotedu-en", "English", "https://stream.radiotedu.com/en"),
        RadioChannel("radiotedu-fr", "Français", "https://stream.radiotedu.com/fr"),
    )
}
