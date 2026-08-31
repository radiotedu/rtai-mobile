package com.radiotedumobile.appfunctions

import android.content.Intent
import android.net.Uri
import androidx.appfunctions.AppFunction
import androidx.appfunctions.AppFunctionInvalidArgumentException
import androidx.appfunctions.AppFunctionService
import androidx.appfunctions.AppFunctionServiceEntryPoint

@AppFunctionServiceEntryPoint(
    serviceName = "RadioTeduAppFunctionService",
    appFunctionXmlFileName = "radiotedu_media",
)
abstract class BaseRadioTeduAppFunctionService : AppFunctionService() {
    /** Opens and starts the requested RadioTEDU station through the shared media app. */
    @AppFunction(isDescribedByKDoc = true)
    fun playRadioTedu(station: String): String {
        val mediaId = STATIONS[normalize(station)]
            ?: throw AppFunctionInvalidArgumentException("Unknown RadioTEDU station")
        open("radiotedu://play/$mediaId")
        return mediaId
    }

    /** Opens RadioTEDU's podcast library. */
    @AppFunction(isDescribedByKDoc = true)
    fun openRadioTeduPodcasts(): String {
        open("radiotedu://podcasts")
        return "podcasts"
    }

    /** Opens the live RadioTEDU song vote without casting a vote for the user. */
    @AppFunction(isDescribedByKDoc = true)
    fun openRadioTeduVoting(): String {
        open("radiotedu://voting")
        return "voting"
    }

    private fun open(uri: String) {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun normalize(value: String): String = value.lowercase()
        .replace(Regex("[^a-z0-9]+"), " ")
        .trim()

    private companion object {
        val STATIONS = mapOf(
            "radiotedu" to "radiotedu-main",
            "radio tedu" to "radiotedu-main",
            "main" to "radiotedu-main",
            "classic" to "radiotedu-classic",
            "classical" to "radiotedu-classic",
            "klasik" to "radiotedu-classic",
            "jazz" to "radiotedu-jazz",
            "caz" to "radiotedu-jazz",
            "lofi" to "radiotedu-lofi",
            "lo fi" to "radiotedu-lofi",
            "rock" to "radiotedu-rock",
            "energize" to "radiotedu-energize",
            "voting" to "radiotedu-spark",
            "english" to "radiotedu-en",
            "french" to "radiotedu-fr",
        )
    }
}
