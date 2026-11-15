package mx.tuapp.pos;

import android.os.Build;
import android.os.Bundle;
import android.view.View;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // El emulador de Android dibuja mal la app con aceleración gráfica (pantallas partidas al abrir menús o ventanas).
        // Solo ahí se dibuja por software; en teléfonos reales no cambia nada.
        if (isEmulator() && getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        }
    }

    private static boolean isEmulator() {
        String hw = Build.HARDWARE == null ? "" : Build.HARDWARE;
        String fp = Build.FINGERPRINT == null ? "" : Build.FINGERPRINT;
        String model = Build.MODEL == null ? "" : Build.MODEL;
        return hw.contains("ranchu") || hw.contains("goldfish") || fp.contains("generic") || fp.contains("emulator")
            || model.contains("sdk_gphone") || model.contains("Emulator");
    }
}
