package com.nowraj.midipatch

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.media.midi.MidiDeviceInfo
import android.media.midi.MidiInputPort
import android.media.midi.MidiManager
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Native Android MIDI bridge for MIDI Patch.
 *
 * INSTALL:
 * 1. `npx cap add android` from the project root (creates the android/ folder).
 * 2. Copy this file to:
 *      android/app/src/main/java/com/nowraj/midipatch/MidiPlugin.kt
 *    (create the com/nowraj/midipatch folders — must match capacitor.config.ts appId).
 * 3. Register the plugin in MainActivity.java/kt (see MainActivity snippet below).
 * 4. Add to android/app/src/main/AndroidManifest.xml, inside <manifest>:
 *      <uses-feature android:name="android.software.midi" android:required="true" />
 *      <uses-feature android:name="android.hardware.usb.host" android:required="true" />
 *    inside the <activity> that hosts Capacitor (usually MainActivity):
 *      <intent-filter>
 *        <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />
 *      </intent-filter>
 *      <meta-data android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"
 *                 android:resource="@xml/device_filter" />
 *    and create android/app/src/main/res/xml/device_filter.xml with an empty
 *    <resources /> root (or vendor/product filters once you know the interface's IDs)
 *    so Android offers to launch MIDI Patch when the USB MIDI interface is plugged in.
 *
 * This class intentionally keeps all MIDI wire-format logic (Bank Select / Program
 * Change byte packing) here rather than in JS, so "sendPatch" is one native call
 * with no round-tripping — matches spec §24 (smoothness: tap → immediate MIDI out).
 */
@CapacitorPlugin(name = "MidiPatch")
class MidiPlugin : Plugin() {

    private lateinit var midiManager: MidiManager
    private lateinit var usbManager: UsbManager
    private var connectedDeviceInfo: MidiDeviceInfo? = null
    private var inputPort: MidiInputPort? = null

    private val usbPermissionAction = "com.nowraj.midipatch.USB_PERMISSION"

    override fun load() {
        midiManager = activity.getSystemService(Context.MIDI_SERVICE) as MidiManager
        usbManager = activity.getSystemService(Context.USB_SERVICE) as UsbManager
        registerDeviceCallback()
    }

    /** Watches for MIDI devices attaching/detaching for automatic reconnect (spec §18). */
    private fun registerDeviceCallback() {
        midiManager.registerDeviceCallback(object : MidiManager.DeviceCallback() {
            override fun onDeviceAdded(device: MidiDeviceInfo) {
                if (connectedDeviceInfo == null && isUsbMidiDevice(device)) {
                    openDevice(device)
                }
            }

            override fun onDeviceRemoved(device: MidiDeviceInfo) {
                if (device == connectedDeviceInfo) {
                    inputPort?.close()
                    inputPort = null
                    connectedDeviceInfo = null
                    emitConnectionChange("reconnecting", null)
                    // MidiManager's onDeviceAdded above fires again automatically
                    // once the same interface re-enumerates after replug.
                }
            }
        }, null)
    }

    private fun isUsbMidiDevice(info: MidiDeviceInfo): Boolean =
        info.type == MidiDeviceInfo.TYPE_USB ||
            info.properties.getParcelable<UsbDevice>(MidiDeviceInfo.PROPERTY_USB_DEVICE) != null

    // ---- Capacitor-exposed methods -------------------------------------------------

    @PluginMethod
    fun requestDevice(call: PluginCall) {
        val usbDevices = usbManager.deviceList.values
        if (usbDevices.isEmpty()) {
            call.resolve(JSObject().put("granted", false))
            return
        }
        val target = usbDevices.first() // V1: first attached USB device; refine with a
        // picker UI once multi-interface setups are common.
        if (usbManager.hasPermission(target)) {
            findAndOpenMatchingMidiDevice(target, call)
        } else {
            requestUsbPermission(target, call)
        }
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val result = JSObject()
        result.put("state", if (connectedDeviceInfo != null) "connected" else "disconnected")
        result.put("device", deviceInfoToJs(connectedDeviceInfo))
        call.resolve(result)
    }

    @PluginMethod
    fun sendPatch(call: PluginCall) {
        val port = inputPort
        if (port == null) {
            call.resolve(JSObject().put("ok", false).put("raw", JSArray()))
            return
        }
        val channel = (call.getInt("channel") ?: 1).coerceIn(1, 16) - 1
        val program = (call.getInt("program") ?: 1).coerceIn(1, 128) - 1
        val bankMSB = if (call.data.has("bankMSB") && !call.data.isNull("bankMSB")) call.getInt("bankMSB") else null
        val bankLSB = if (call.data.has("bankLSB") && !call.data.isNull("bankLSB")) call.getInt("bankLSB") else null
        val sendBank = call.getBoolean("sendBankSelect") ?: true
        val sendPC = call.getBoolean("sendProgramChange") ?: true

        val raw = JSArray()
        val buffer = ByteArray(9)
        var len = 0

        fun appendControlChange(controller: Int, value: Int) {
            buffer[len++] = (0xB0 or channel).toByte()
            buffer[len++] = controller.toByte()
            buffer[len++] = value.toByte()
        }

        if (sendBank) {
            bankMSB?.let { appendControlChange(0x00, it.coerceIn(0, 127)) }
            bankLSB?.let { appendControlChange(0x20, it.coerceIn(0, 127)) }
        }
        if (sendPC) {
            buffer[len++] = (0xC0 or channel).toByte()
            buffer[len++] = program.toByte()
        }

        try {
            port.send(buffer, 0, len)
            // Build a hex log matching what was actually sent, for the JS-side monitor.
            var i = 0
            while (i < len) {
                val isCC = (buffer[i].toInt() and 0xF0) == 0xB0
                val chunk = if (isCC) 3 else 2
                val sb = StringBuilder()
                for (j in 0 until chunk) sb.append(String.format("%02x ", buffer[i + j]))
                raw.put(sb.toString().trim())
                i += chunk
            }
            call.resolve(JSObject().put("ok", true).put("raw", raw))
        } catch (e: Exception) {
            call.resolve(JSObject().put("ok", false).put("raw", JSArray()))
        }
    }

    @PluginMethod
    fun sendRaw(call: PluginCall) {
        // Prebuilt raw MIDI bytes from JS (e.g. CC 123 + a Roland DT1 SysEx
        // frame for the Performance Part patch-assignment write). Byte packing
        // lives JS-side; the port write stays one native call.
        val port = inputPort
        val bytes = call.getArray("bytes")
        if (port == null || bytes == null || bytes.length() == 0) {
            call.resolve(JSObject().put("ok", false))
            return
        }
        val len = bytes.length()
        val buffer = ByteArray(len)
        for (i in 0 until len) buffer[i] = bytes.getInt(i).toByte()
        try {
            port.send(buffer, 0, len)
            call.resolve(JSObject().put("ok", true))
        } catch (e: Exception) {
            call.resolve(JSObject().put("ok", false))
        }
    }

    // ---- USB permission + device opening ---------------------------------------------

    private fun requestUsbPermission(device: UsbDevice, call: PluginCall) {
        val permissionIntent = android.app.PendingIntent.getBroadcast(
            activity, 0, Intent(usbPermissionAction),
            android.app.PendingIntent.FLAG_MUTABLE
        )
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                activity.unregisterReceiver(this)
                val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                if (granted) {
                    findAndOpenMatchingMidiDevice(device, call)
                } else {
                    call.resolve(JSObject().put("granted", false))
                }
            }
        }
        activity.registerReceiver(receiver, IntentFilter(usbPermissionAction))
        usbManager.requestPermission(device, permissionIntent)
    }

    private fun findAndOpenMatchingMidiDevice(usbDevice: UsbDevice, call: PluginCall) {
        midiManager.getDevices().firstOrNull { info ->
            info.properties.getParcelable<UsbDevice>(MidiDeviceInfo.PROPERTY_USB_DEVICE)?.deviceId == usbDevice.deviceId
        }?.let { info ->
            openDevice(info)
            call.resolve(JSObject().put("granted", true))
        } ?: call.resolve(JSObject().put("granted", false))
    }

    private fun openDevice(info: MidiDeviceInfo) {
        midiManager.openDevice(info, { device ->
            if (device == null) {
                emitConnectionChange("disconnected", null)
                return@openDevice
            }
            // Port 0: fine for single-port USB MIDI interfaces (the common case here).
            // Multi-port interfaces would need a port picker in Settings.
            inputPort = device.openInputPort(0)
            connectedDeviceInfo = info
            emitConnectionChange("connected", info)
        }, null)
    }

    private fun deviceInfoToJs(info: MidiDeviceInfo?): JSObject? {
        if (info == null) return null
        val name = info.properties.getString(MidiDeviceInfo.PROPERTY_NAME)
            ?: info.properties.getString(MidiDeviceInfo.PROPERTY_PRODUCT)
            ?: "USB MIDI"
        return JSObject().put("id", info.id.toString()).put("name", name)
    }

    private fun emitConnectionChange(state: String, info: MidiDeviceInfo?) {
        val data = JSObject()
        data.put("state", state)
        data.put("device", deviceInfoToJs(info))
        notifyListeners("connectionChange", data)
    }
}
