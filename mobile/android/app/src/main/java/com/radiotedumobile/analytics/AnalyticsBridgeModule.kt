package com.radiotedumobile.analytics

import android.os.Bundle
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.firebase.analytics.FirebaseAnalytics

class AnalyticsBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val analytics = FirebaseAnalytics.getInstance(reactContext)

    override fun getName(): String = "RadioTeduAnalyticsBridge"

    @ReactMethod
    fun setCollectionEnabled(enabled: Boolean) {
        val status = if (enabled) {
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
        analytics.setAnalyticsCollectionEnabled(enabled)
        if (!enabled) analytics.resetAnalyticsData()
    }

    @ReactMethod
    fun setDemographics(ageRange: String?, gender: String?) {
        analytics.setUserProperty("age_range", ageRange)
        analytics.setUserProperty("gender", gender)
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
