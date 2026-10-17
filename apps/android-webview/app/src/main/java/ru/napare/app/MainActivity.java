package ru.napare.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JsResult;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import org.json.JSONObject;

/** Thin HTTPS client: authentication, permissions and role routing belong to the website. */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://napare.sano.ru";
    private static final String LOGIN = ORIGIN + "/login";
    private static final int FILE_REQUEST = 41;
    private static final int SAVE_CALENDAR = 42;
    private byte[] pendingCalendar;
    private WebView web;
    private ProgressBar progress;
    private LinearLayout errorPanel;
    private TextView errorText;
    private ValueCallback<Uri[]> fileCallback;
    private boolean failed;
    private String retryUrl = LOGIN;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);
        web = new WebView(this);
        web.setVisibility(View.INVISIBLE);
        web.setSaveEnabled(false);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progress, new FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP));
        createErrorPanel(root);
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) {
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            });
        } else { root.setFitsSystemWindows(true); }
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUserAgentString(settings.getUserAgentString() + " NaPareAndroid/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new SiteClient());
        web.setWebChromeClient(new ChromeClient());
        configureDownloads();
        // The website restores a valid session from its origin-scoped local storage.
        web.loadUrl(LOGIN);
    }

    private boolean isSite(Uri uri) {
        return uri != null && "https".equalsIgnoreCase(uri.getScheme())
                && "napare.sano.ru".equalsIgnoreCase(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null;
    }

    private boolean route(Uri uri) {
        if (isSite(uri)) return false;
        String scheme = uri == null ? "" : uri.getScheme();
        if ("https".equalsIgnoreCase(scheme) || "mailto".equalsIgnoreCase(scheme)
                || "tel".equalsIgnoreCase(scheme) || "max".equalsIgnoreCase(scheme)) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
            catch (ActivityNotFoundException ignored) { toast("Нет приложения для открытия ссылки"); }
        } else { toast("Эта ссылка недоступна в приложении"); }
        return true;
    }

    private final class SiteClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return request.isForMainFrame() && route(request.getUrl());
        }
        @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
            failed = false;
            errorPanel.setVisibility(View.GONE);
            progress.setVisibility(View.VISIBLE);
            if (isSite(Uri.parse(url))) retryUrl = url;
        }
        @Override public void onPageFinished(WebView view, String url) {
            progress.setVisibility(View.GONE);
            if (failed) return;
            view.setVisibility(View.VISIBLE);
            if (isSite(Uri.parse(url)) && "/login".equals(Uri.parse(url).getPath())) view.clearHistory();
        }
        @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) showError("Не удалось открыть НаПаре. Проверьте интернет и повторите загрузку.");
        }
        @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            if (request.isForMainFrame() && response.getStatusCode() >= 400)
                showError("Сайт временно недоступен (" + response.getStatusCode() + "). Повторите загрузку позже.");
        }
        @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            handler.cancel();
            showError("Не удалось проверить защищённое соединение с НаПаре. Проверьте дату на телефоне или повторите позже.");
        }
    }

    private final class ChromeClient extends WebChromeClient {
        @Override public void onProgressChanged(WebView view, int value) { progress.setProgress(value); }
        @Override public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
            if (!isSite(Uri.parse(url))) { result.cancel(); return true; }
            new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("ОК", (d, which) -> result.confirm())
                    .setOnCancelListener(d -> result.cancel()).show();
            return true;
        }
        @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
            if (!isSite(Uri.parse(url))) { result.cancel(); return true; }
            new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("Продолжить", (d, which) -> result.confirm())
                    .setNegativeButton("Отмена", (d, which) -> result.cancel())
                    .setOnCancelListener(d -> result.cancel()).show();
            return true;
        }
        @Override public boolean onJsBeforeUnload(WebView view, String url, String message, JsResult result) {
            return onJsConfirm(view, url, message, result);
        }
        @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            try { startActivityForResult(params.createIntent(), FILE_REQUEST); }
            catch (ActivityNotFoundException ignored) { fileCallback.onReceiveValue(null); fileCallback = null; toast("Не найден выбор файлов"); }
            return true;
        }
        @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean gesture, Message message) {
            if (!gesture) return false;
            WebView popup = new WebView(MainActivity.this);
            popup.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                    Uri uri = request.getUrl();
                    if (isSite(uri)) web.loadUrl(uri.toString()); else route(uri);
                    v.post(v::destroy);
                    return true;
                }
            });
            ((WebView.WebViewTransport) message.obj).setWebView(popup);
            message.sendToTarget();
            return true;
        }
    }

    private void configureDownloads() {
        boolean supported = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) WebViewCompat.addWebMessageListener(web, "NaPareCalendar",
                Collections.singleton(ORIGIN), (view, message, origin, mainFrame, reply) -> {
                    if (!mainFrame || !isSite(origin) || pendingCalendar != null) return;
                    String encoded = message.getData();
                    if (encoded == null || encoded.length() > 3_000_000) { toast("Файл слишком большой"); return; }
                    try {
                        byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
                        String calendar = new String(bytes, StandardCharsets.UTF_8);
                        if (!calendar.startsWith("BEGIN:VCALENDAR") || !calendar.contains("END:VCALENDAR")) return;
                        pendingCalendar = bytes;
                        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                        intent.addCategory(Intent.CATEGORY_OPENABLE);
                        intent.setType("text/calendar");
                        intent.putExtra(Intent.EXTRA_TITLE, "napare-schedule.ics");
                        startActivityForResult(intent, SAVE_CALENDAR);
                    } catch (IllegalArgumentException | ActivityNotFoundException ignored) {
                        pendingCalendar = null;
                        toast("Не удалось сохранить календарь");
                    }
                });
        web.setDownloadListener((url, userAgent, disposition, mime, length) -> {
            Uri uri = Uri.parse(url);
            if (url.startsWith("blob:" + ORIGIN + "/") && isSite(Uri.parse(web.getUrl()))) {
                if (!supported) { toast("Обновите Android System WebView для сохранения календаря"); return; }
                web.evaluateJavascript("fetch(" + JSONObject.quote(url) + ").then(r=>r.blob()).then(b=>{"
                        + "if(b.size>2000000)return;const reader=new FileReader();"
                        + "reader.onload=()=>NaPareCalendar.postMessage(String(reader.result).split(',')[1]);"
                        + "reader.readAsDataURL(b);}).catch(()=>{});", null);
            } else if ("https".equalsIgnoreCase(uri.getScheme())) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                catch (ActivityNotFoundException ignored) { toast("Нет браузера для скачивания файла"); }
            } else { toast("Этот файл нельзя скачать в приложении"); }
        });
    }

    private void createErrorPanel(FrameLayout root) {
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(24), dp(24), dp(24), dp(24));
        errorPanel.setBackgroundColor(Color.WHITE);
        errorPanel.setVisibility(View.GONE);
        errorText = new TextView(this);
        errorText.setTextSize(18);
        errorText.setTextColor(Color.rgb(23, 36, 58));
        errorText.setGravity(Gravity.CENTER);
        errorPanel.addView(errorText);
        Button retry = new Button(this);
        retry.setText("Повторить");
        retry.setOnClickListener(v -> { errorPanel.setVisibility(View.GONE); web.loadUrl(isSite(Uri.parse(retryUrl)) ? retryUrl : LOGIN); });
        errorPanel.addView(retry);
        root.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1));
    }
    private void showError(String message) {
        failed = true;
        progress.setVisibility(View.GONE);
        web.setVisibility(View.INVISIBLE);
        errorText.setText(message);
        errorPanel.setVisibility(View.VISIBLE);
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_SHORT).show(); }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == FILE_REQUEST && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        }
        if (request == SAVE_CALENDAR && pendingCalendar != null) {
            byte[] bytes = pendingCalendar;
            pendingCalendar = null;
            if (result == RESULT_OK && data != null && data.getData() != null) {
                try (OutputStream stream = getContentResolver().openOutputStream(data.getData())) {
                    if (stream == null) throw new java.io.IOException("No output stream");
                    stream.write(bytes);
                    toast("Календарь сохранён");
                } catch (java.io.IOException | SecurityException ignored) { toast("Не удалось записать файл"); }
            }
        }
    }
    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
    @Override protected void onPause() { web.onPause(); CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        web.destroy();
        super.onDestroy();
    }
}
