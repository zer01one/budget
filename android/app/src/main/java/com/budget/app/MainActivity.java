package com.budget.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VaultFilePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
