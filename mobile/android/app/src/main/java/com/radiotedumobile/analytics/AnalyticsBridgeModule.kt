package com.radiotedumobile.analytics

import android.content.Context
import android.os.Bundle
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.firebase.analytics.FirebaseAnalytics

class AnalyticsBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val CURRENT_CONSENT_VERSION = 6
        private const val PREFS = "radiotedu_analytics_consent"
        private const val KEY_VERSION = "version"

        fun revokeStaleConsent(context: Context) {
            val storedVersion = context
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getInt(KEY_VERSION, 0)
            if (storedVersion == CURRENT_CONSENT_VERSION) return
            val analytics = FirebaseAnalytics.getInstance(context)
            analytics.setConsent(deniedConsent())
            analytics.setAnalyticsCollectionEnabled(false)
            analytics.resetAnalyticsData()
        }

        private fun deniedConsent() = mapOf(
            FirebaseAnalytics.ConsentType.ANALYTICS_STORAGE to
                FirebaseAnalytics.ConsentStatus.DENIED,
            FirebaseAnalytics.ConsentType.AD_STORAGE to
                FirebaseAnalytics.ConsentStatus.DENIED,
            FirebaseAnalytics.ConsentType.AD_USER_DATA to
                FirebaseAnalytics.ConsentStatus.DENIED,
            FirebaseAnalytics.ConsentType.AD_PERSONALIZATION to
                FirebaseAnalytics.ConsentStatus.DENIED,
        )
    }

    private val analytics = FirebaseAnalytics.getInstance(reactContext)

    override fun getName(): String = "RadioTeduAnalyticsBridge"

    @ReactMethod
    fun setCollectionEnabled(enabled: Boolean, consentVersion: Int) {
        val acceptedVersion = if (consentVersion == CURRENT_CONSENT_VERSION) {
            consentVersion
        } else {
            0
        }
        reactApplicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putInt(KEY_VERSION, acceptedVersion)
            .apply()
        val versionedEnabled = enabled && acceptedVersion == CURRENT_CONSENT_VERSION
        val status = if (versionedEnabled) {
            FirebaseAnalytics.ConsentStatus.GRANTED
        } else {
            FirebaseAnalytics.ConsentStatus.DENIED
        }
        analytics.setConsent(
            mapOf(
                FirebaseAnalytics.ConsentType.ANALYTICS_STORAGE to status,
                FirebaseAnalytics.ConsentType.AD_STORAGE to FirebaseAnalytics.ConsentStatus.DENIED,
                FirebaseAnalytics.ConsentType.AD_USER_DATA to FirebaseAnalytics.ConsentStatus.DENIED,
                FirebaseAnalytics.ConsentType.AD_PERSONALIZATION to FirebaseAnalytics.ConsentStatus.DENIED,
            ),
        )
        analytics.setAnalyticsCollectionEnabled(versionedEnabled)
        if (!versionedEnabled) analytics.resetAnalyticsData()
    }

    @ReactMethod
    fun setDemographics(ageRange: String?, gender: String?) {
        analytics.setUserProperty("age_range", ageRange)
        analytics.setUserProperty("gender", gender)
    }

    @ReactMethod
    fun setListeningContext(context: String?) {
        analytics.setUserProperty("listening_context", context)
    }

    @ReactMethod
    fun logEvent(name: String, params: ReadableMap) {
        analytics.logEvent(name, params.toBundle())
    }

    private fun ReadableMap.toBundle(): Bundle = Bundle().also { bundle ->
        val iterator = keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            when (getType(key)) {
                ReadableType.String -> bundle.putString(key, getString(key))
                ReadableType.Number -> bundle.putDouble(key, getDouble(key))
                ReadableType.Boolean -> bundle.putBoolean(key, getBoolean(key))
                else -> Unit
            }
        }
    }
}
