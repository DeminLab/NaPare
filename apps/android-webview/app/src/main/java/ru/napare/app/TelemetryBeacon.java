package ru.napare.app;

import android.os.Build;
import android.webkit.WebView;
import java.util.UUID;

/**
 * NaPare Client Telemetry Beacon for Android WebView.
 *
 * Injects JavaScript into the loaded web page to:
 * 1. Generate or retrieve a persistent installId (stored in localStorage).
 * 2. Send an app.open event to /api/v1/telemetry/events on every cold start.
 * 3. Send page.view events for every navigation inside the WebView.
 *
 * This file is intentionally dependency-free (uses only Android SDK + WebView JS).
 * No sensitive data (passwords, tokens, emails) is ever sent.
 */
public final class TelemetryBeacon {

    private static final String API_BASE = "/api/v1";
    private static final String INSTALL_KEY = "napare:install_id";
    private static final String OPEN_FLAG = "napare:app_opened";

    private TelemetryBeacon() {}

    /**
     * Call from MainActivity.onPageFinished() after the site URL is confirmed.
     * Generates installId, sends app.open (once per session) and page.view.
     */
    public static void inject(WebView web) {
        String js = buildScript();
        web.evaluateJavascript(js, null);
    }

    /**
     * Call when the WebView is being destroyed or the activity is paused.
     */
    public static void flush(WebView web) {
        web.evaluateJavascript(
            "(function(){try{var b=window.__napareBeacon;if(b&&b.flush)b.flush();}catch(e){}})();",
            null
        );
    }

    private static String buildScript() {
        return "(function(){"
            + "var API='" + API_BASE + "';"
            + "var INSTALL='" + INSTALL_KEY + "';"
            + "var OPEN='" + OPEN_FLAG + "';"
            + "var id=localStorage.getItem(INSTALL);"
            + "if(!id){"
            + "  var bytes=new Uint8Array(16);"
            + "  window.crypto.getRandomValues(bytes);"
            + "  id=Array.from(bytes,function(b){return b.toString(16).padStart(2,'0');}).join('');"
            + "  localStorage.setItem(INSTALL,id);"
            + "};"
            + // Send app.open once per session
            "if(sessionStorage.getItem(OPEN)!=='1'){"
            + "  sessionStorage.setItem(OPEN,'1');"
            + "  fetch(API+'/telemetry/events',{"
            + "    method:'POST',"
            + "    headers:{'Content-Type':'application/json'},"
            + "    body:JSON.stringify({events:[{name:'app.open',path:'/',metadata:{installId:id,os:'android',api:'" + Build.VERSION.SDK_INT + "',model:'" + Build.MODEL + "'}}],installId:id,app:'android'})"
            + "  }).catch(function(){});"
            + "};"
            + // Page view for every navigation
            "fetch(API+'/telemetry/events',{"
            + "  method:'POST',"
            + "  headers:{'Content-Type':'application/json'},"
            + "  body:JSON.stringify({events:[{name:'page.view',path:location.pathname,metadata:{installId:id,os:'android'}}],installId:id,app:'android'})"
            + "}).catch(function(){});"
            + // Expose flush for pagehide
            "window.__napareBeacon={"
            + "  flush:function(){"
            + "    navigator.sendBeacon&&navigator.sendBeacon(API+'/telemetry/events',JSON.stringify({events:[],installId:id,app:'android'}));"
            + "  }"
            + "};"
            + "window.addEventListener('pagehide',function(){window.__napareBeacon.flush();});"
            + "})();";
    }
}
