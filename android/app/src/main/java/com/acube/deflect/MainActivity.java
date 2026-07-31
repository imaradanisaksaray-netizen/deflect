package com.acube.deflect;

import android.os.Bundle;
import android.view.View;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Hosts the web game and puts it in immersive full screen.
 *
 * The game paints its playfield to every edge and reads the shield angle from
 * wherever a finger lands, so a status bar on top of it is both a break in a
 * dark neon scene and a strip of screen that swallows touches meant for the game.
 *
 * The bars stay reachable — a swipe from an edge brings them back — and they
 * hide again afterwards. That is the behaviour Android expects from a game,
 * unlike sticky mode, which fights the user for control of the edges.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyImmersiveMode();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Returning from an ad, a phone call or the recents screen restores the
        // system bars, so immersive mode has to be re-applied rather than set
        // once at startup.
        if (hasFocus) {
            applyImmersiveMode();
        }
    }

    private void applyImmersiveMode() {
        View decorView = getWindow().getDecorView();
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), decorView);

        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
