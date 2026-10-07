package il.magialecha.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * עטיפה דקה סביב האתר. אם הוגדרה כתובת אתר (site_url), נטען האתר החי, כך שכל עדכון,
 * מקום חדש והמלצה מגיעים בלי APK חדש. בלי רשת, או בלי כתובת, נטען העותק שבתוך האפליקציה (assets/www).
 * קישורים לטלפון, לוואטסאפ, למייל ולאתרים חיצוניים נפתחים באפליקציה המתאימה בטלפון.
 */
public class MainActivity extends Activity {
    private WebView web;
    private String site;
    private boolean fellBack = false;
    private static final String LOCAL = "file:///android_asset/www/index.html";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);       // התשובות לשאלון ומצב עמום נשמרים במכשיר
        s.setAllowFileAccess(true);
        s.setTextZoom(100);

        site = getString(R.string.site_url).trim();
        final String siteHost = site.isEmpty() ? "" : Uri.parse(site).getHost();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                // אין רשת: עוברים לעותק המקומי (פעם אחת)
                if (request.isForMainFrame() && !fellBack) { fellBack = true; view.loadUrl(LOCAL); }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("file".equals(uri.getScheme())) return false;   // ניווט בתוך האפליקציה
                if (!siteHost.isEmpty() && siteHost.equals(uri.getHost())) return false;
                try {
                    String scheme = uri.getScheme();
                    Intent intent = "tel".equals(scheme)
                            ? new Intent(Intent.ACTION_DIAL, uri)
                            : new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(intent);
                } catch (Exception ignored) { /* אין אפליקציה מתאימה */ }
                return true;
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(site.isEmpty() ? LOCAL : site);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
