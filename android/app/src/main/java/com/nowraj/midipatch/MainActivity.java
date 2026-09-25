package com.nowraj.midipatch;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    registerPlugin(MidiPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
