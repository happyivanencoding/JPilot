import SwiftUI
import UIKit
import UniformTypeIdentifiers
import WebKit

struct WebContainer: UIViewRepresentable {
    let url: URL
    let reloadID: UUID
    let onLoadStateChange: (LoadState) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.applicationNameForUserAgent = "JobPilot-iOS/0.1"
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsLinkPreview = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.backgroundColor = UIColor(JobPilotTheme.background)
        webView.isOpaque = false
        webView.accessibilityLabel = "JobPilot 工作台"
        context.coordinator.lastReloadID = reloadID
        context.coordinator.load(url: url, in: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.lastReloadID != reloadID else { return }
        context.coordinator.lastReloadID = reloadID
        context.coordinator.load(url: url, in: webView)
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, UIDocumentPickerDelegate {
        private let parent: WebContainer
        var lastReloadID = UUID()
        private var documentCompletion: (([URL]?) -> Void)?

        init(_ parent: WebContainer) {
            self.parent = parent
        }

        func load(url: URL, in webView: WKWebView) {
            var request = URLRequest(url: url)
            request.cachePolicy = .useProtocolCachePolicy
            request.setValue("JobPilot-iOS", forHTTPHeaderField: "X-JobPilot-Client")
            webView.load(request)
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            DispatchQueue.main.async { self.parent.onLoadStateChange(.loading) }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            DispatchQueue.main.async { self.parent.onLoadStateChange(.ready) }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            guard (error as NSError).code != NSURLErrorCancelled else { return }
            DispatchQueue.main.async { self.parent.onLoadStateChange(.failed(error.localizedDescription)) }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            guard (error as NSError).code != NSURLErrorCancelled else { return }
            DispatchQueue.main.async { self.parent.onLoadStateChange(.failed(error.localizedDescription)) }
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let destination = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
                decisionHandler(.cancel)
                return
            }

            let isWebLink = destination.scheme == "http" || destination.scheme == "https"
            if isWebLink {
                // Keep web authentication and the full JobPilot flow inside one
                // WKWebView session so cookies and local state remain available.
                decisionHandler(.allow)
                return
            }

            UIApplication.shared.open(destination)
            decisionHandler(.cancel)
        }

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            webView.load(navigationAction.request)
            return nil
        }

        func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
            documentCompletion = completionHandler
            let picker = UIDocumentPickerViewController(
                forOpeningContentTypes: [.pdf, .plainText, .data],
                asCopy: true
            )
            picker.allowsMultipleSelection = parameters.allowsMultipleSelection
            picker.delegate = self
            topViewController(from: webView)?.present(picker, animated: true)
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            documentCompletion?(urls)
            documentCompletion = nil
        }

        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            documentCompletion?(nil)
            documentCompletion = nil
        }

        private func topViewController(from view: UIView) -> UIViewController? {
            var controller = view.window?.rootViewController
            while let presented = controller?.presentedViewController { controller = presented }
            if let navigation = controller as? UINavigationController { return navigation.visibleViewController }
            if let tab = controller as? UITabBarController { return tab.selectedViewController }
            return controller
        }
    }
}
