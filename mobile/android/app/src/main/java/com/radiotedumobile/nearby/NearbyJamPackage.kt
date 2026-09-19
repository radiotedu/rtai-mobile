package com.radiotedumobile.nearby

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*

class NearbyJamPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(NearbyJamModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

class NearbyJamModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), LifecycleEventListener {
  private val client by lazy { Nearby.getConnectionsClient(context) }
  private val serviceId = "com.radiotedumobile.jam.v1"
  private var generation = 0
  init { context.addLifecycleEventListener(this) }
  override fun getName() = "NearbyJam"

  private fun emit(endpoint: String, code: String?) {
    val event = Arguments.createMap().apply {
      putString("endpointId", endpoint)
      putString("roomCode", code)
    }
    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("NearbyJamBeacon", event)
  }

  @ReactMethod fun startAdvertising(code: String, promise: Promise) {
    if (!Regex("^[0-9]{6}$").matches(code)) { promise.reject("INVALID_CODE", "Invalid room code"); return }
    val request = ++generation
    val callback = object : ConnectionLifecycleCallback() {
      // Only discover a room invitation. Never accept an unauthenticated peer connection.
      override fun onConnectionInitiated(id: String, info: ConnectionInfo) { client.rejectConnection(id) }
      override fun onConnectionResult(id: String, result: ConnectionResolution) {}
      override fun onDisconnected(id: String) {}
    }
    try {
      client.startAdvertising("RTJ1:$code", serviceId, callback,
        AdvertisingOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build())
        .addOnSuccessListener {
          if (request != generation) { client.stopAdvertising(); promise.reject("CANCELLED", "Closed") }
          else promise.resolve(null)
        }.addOnFailureListener { promise.reject("NEARBY_UNAVAILABLE", "Nearby advertising unavailable") }
    } catch (_: SecurityException) { promise.reject("PERMISSION_DENIED", "Nearby permission required") }
  }

  @ReactMethod fun startDiscovery(promise: Promise) {
    val request = ++generation
    val callback = object : EndpointDiscoveryCallback() {
      override fun onEndpointFound(id: String, info: DiscoveredEndpointInfo) {
        if (request != generation || info.serviceId != serviceId) return
        val match = Regex("^RTJ1:([0-9]{6})$").matchEntire(info.endpointName) ?: return
        emit(id, match.groupValues[1])
      }
      override fun onEndpointLost(id: String) { if (request == generation) emit(id, null) }
    }
    try {
      client.startDiscovery(serviceId, callback, DiscoveryOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build())
        .addOnSuccessListener {
          if (request != generation) { client.stopDiscovery(); promise.reject("CANCELLED", "Closed") }
          else promise.resolve(null)
        }.addOnFailureListener { promise.reject("NEARBY_UNAVAILABLE", "Nearby discovery unavailable") }
    } catch (_: SecurityException) { promise.reject("PERMISSION_DENIED", "Nearby permission required") }
  }

  @ReactMethod fun stop() {
    generation++
    try { client.stopAdvertising(); client.stopDiscovery() } catch (_: SecurityException) {
      // The user may revoke permission while discovery is active.
    }
  }
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}
  override fun onHostResume() {}
  override fun onHostPause() { stop() }
  override fun onHostDestroy() { stop() }
  override fun invalidate() { stop(); context.removeLifecycleEventListener(this); super.invalidate() }
}
