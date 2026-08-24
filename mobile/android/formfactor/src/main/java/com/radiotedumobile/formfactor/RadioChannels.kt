package com.radiotedumobile.formfactor

data class RadioChannel(val id: String, val title: String, val url: String)

object RadioChannels {
    val all = listOf(
        RadioChannel("radiotedu-main", "RadioTEDU", "https://stream.radiotedu.com/radio"),
        RadioChannel("radiotedu-classic", "RadioTEDU Classical", "https://stream.radiotedu.com/classic"),
        RadioChannel("radiotedu-jazz", "RadioTEDU Jazz", "https://stream.radiotedu.com/cazz"),
        RadioChannel("radiotedu-lofi", "RadioTEDU Lo-Fi", "https://stream.radiotedu.com/lofi"),
        RadioChannel("radiotedu-energize", "RadioTEDU Energize", "https://stream.radiotedu.com/energize"),
        RadioChannel("radiotedu-rock", "RadioTEDU Rock", "https://stream.radiotedu.com/rock"),
        RadioChannel("radiotedu-en", "RadioTEDU English", "https://stream.radiotedu.com/en"),
        RadioChannel("radiotedu-fr", "RadioTEDU Français", "https://stream.radiotedu.com/fr"),
    )
}
