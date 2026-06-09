import SwiftUI
import WebKit

// MARK: - Main App Entry
@main
struct PnBApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .ignoresSafeArea()
                .preferredColorScheme(.dark)
        }
    }
}

// MARK: - Root Content View
struct ContentView: View {
    var body: some View {
        WebView(url: URL(string: "https://pnbapp.vercel.app/chat")!)
            .ignoresSafeArea()
            .background(Color(hex: "#080A0E"))
    }
}

// MARK: - WKWebView Wrapper
struct WebView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()

        // Allow inline media & autoplay (needed for calls/video)
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Allow camera & microphone access via WebRTC
        config.allowsAirPlayForMediaPlayback = true

        // User content controller for JS bridge
        let userContentController = WKUserContentController()
        config.userContentController = userContentController

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = UIColor(Color(hex: "#080A0E"))
        webView.scrollView.backgroundColor = UIColor(Color(hex: "#080A0E"))

        // Allow back/forward swipe gestures
        webView.allowsBackForwardNavigationGestures = true

        // Load the app
        let request = URLRequest(url: url, cachePolicy: .useProtocolCachePolicy)
        webView.load(request)

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    // MARK: - Coordinator
    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var parent: WebView

        init(_ parent: WebView) {
            self.parent = parent
        }

        // Keep all navigation within the app (handle internal links)
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            // Allow pnbapp.vercel.app and any vercel preview URLs
            if url.host?.contains("vercel.app") == true ||
               url.host?.contains("pnbapp") == true ||
               url.scheme == "about" {
                decisionHandler(.allow)
            } else {
                // Open external links (firebase auth redirects etc) in Safari
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            }
        }

        // Allow camera/mic permission requests from web content
        func webView(_ webView: WKWebView,
                     requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                     initiatedByFrame frame: WKFrameInfo,
                     type: WKMediaCaptureType,
                     decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.grant)
        }

        // Handle new window / target="_blank" links inline
        func webView(_ webView: WKWebView,
                     createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
            }
            return nil
        }

        // Show JS alerts/confirms as native dialogs
        func webView(_ webView: WKWebView,
                     runJavaScriptAlertPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping () -> Void) {
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let root = scene.windows.first?.rootViewController {
                root.present(alert, animated: true)
            } else {
                completionHandler()
            }
        }
    }
}

// MARK: - Hex Color Helper
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
