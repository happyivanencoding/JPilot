import Foundation

enum AppConfig {
    static let productionURL = URL(string: "https://jobs.thegreatnovel.com/")!
    static let stagingURL = URL(string: "https://jobs-staging.thegreatnovel.com/")!
    static let v1PreviewURL = URL(string: "https://jobs-v1.thegreatnovel.com/")!
    static let version = "0.4.8"
    static let supportedHosts = [
        "jobs.thegreatnovel.com",
        "jobs-staging.thegreatnovel.com",
        "jobs-v1.thegreatnovel.com"
    ]

    static var apiBaseURL: URL {
        configuredURL(forInfoKey: "API_BASE_URL") ?? stagingURL
    }

    static var webBaseURL: URL {
        configuredURL(forInfoKey: "WEB_BASE_URL") ?? stagingURL
    }

    // Compatibility alias for callers that only need the web origin.
    static var baseURL: URL { webBaseURL }

    static var usesNativeAuthentication: Bool {
        webBaseURL.host == productionURL.host
    }

    static var isV1Preview: Bool {
        webBaseURL.host == v1PreviewURL.host
    }

    private static func configuredURL(forInfoKey key: String) -> URL? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: key) as? String,
              let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.scheme == "https",
              let host = url.host,
              supportedHosts.contains(host) else {
            return nil
        }
        return url
    }
}
