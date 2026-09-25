# MIDI Patch — setup

This is the scaffold for the spec we froze: a resizable-grid, offline Android
MIDI patch launcher, first target the Roland XP-30. It's a real starting
point, not a finished app — the biggest unverified piece is the exact XP-30
bank MSB/LSB table (see the big comment in `src/data/xp30.ts`) and the native
MIDI plugin, which needs an actual USB MIDI interface + XP-30 to test against.

## 1. Install dependencies

```bash
cd midi-patch
npm install
```

## 2. Run the UI in a desktop browser (fast iteration, no phone needed)

```bash
npm run dev
```

This runs the whole app — grid, pages, patch editor, settings, MIDI monitor —
in Chrome. Patch sending falls back to the **Web MIDI API** in this mode
(`src/midi/MidiBridge.ts`), so if you plug a USB MIDI interface into your
*computer*, "Test Patch" will actually work while you build the UI. This
fallback never runs on the Android build — Android's WebView has no Web MIDI,
so on-device everything goes through the native Kotlin plugin.

## 3. Add the Android project

```bash
npx cap add android
```

This generates the `android/` folder from `capacitor.config.ts`.

## 4. Install the native MIDI plugin

The file `android-native-plugin/MidiPlugin.kt` in this repo is *not* copied
in automatically — Capacitor's `add android` only sets up the shell. Do this
once:

1. Create the folder:
   ```bash
   mkdir -p android/app/src/main/java/com/nowraj/midipatch
   ```
2. Copy the plugin in:
   ```bash
   cp android-native-plugin/MidiPlugin.kt android/app/src/main/java/com/nowraj/midipatch/
   ```
3. Open `android/app/src/main/java/com/nowraj/midipatch/MainActivity.java` (Capacitor
   creates this) and register the plugin **before** `super.onCreate`:

   ```java
   import com.getcapacitor.BridgeActivity;
   import com.nowraj.midipatch.MidiPlugin;

   public class MainActivity extends BridgeActivity {
     @Override
     public void onCreate(android.os.Bundle savedInstanceState) {
       registerPlugin(MidiPlugin.class);
       super.onCreate(savedInstanceState);
     }
   }
   ```

4. Edit `android/app/src/main/AndroidManifest.xml` — add inside `<manifest>`:

   ```xml
   <uses-feature android:name="android.software.midi" android:required="true" />
   <uses-feature android:name="android.hardware.usb.host" android:required="true" />
   ```

   Full setup notes (including the optional USB-attach intent filter that lets
   Android auto-launch the app when the interface is plugged in) are in the
   comment block at the top of `MidiPlugin.kt`.

## 5. Build + sync + open in Android Studio

```bash
npm run build
npx cap sync android
npx cap open android
```

Then build/run from Android Studio onto the Realme 14T 5G (or any modern
Android device with USB host support) over USB debugging, or export a debug
APK from Build → Build Bundle(s)/APK(s) → Build APK(s).

## 6. First real test (spec §28 — the actual success criterion)

1. XP-30 → 5-pin MIDI → USB MIDI interface → OTG → phone.
2. Open MIDI Patch, tap the "MIDI Disconnected" pill to trigger the USB
   permission dialog.
3. Add a patch via "Roland XP-30 Library" → pick a bank → pick a program
   number, or via "Custom MIDI Patch" if you already know the values.
4. Tap **TEST PATCH** in the editor and confirm the XP-30 actually changes
   tone. If it doesn't, open the MIDI Monitor (📡 icon) to see the exact
   bytes sent and cross-check them against the XP-30's own "MIDI
   Implementation" chapter — that's the moment to correct
   `src/data/xp30.ts` if the bank numbers are off for your unit.

## What's deliberately not built yet (matches spec §27)

Pages/pads/settings/monitor/import-export-file-format and Performance Mode
toggle exist; full drag-to-reorder pads, the `.midipatch` import/export file
I/O, and a multi-USB-port picker are stubbed or simplified and are the
natural next slice of work.
