import Foundation

enum AppConfig {
    static let productionURL = URL(string: "https://jobs.thegreatnovel.com/")!
    static let supportedHosts = [
        "jobs.thegreatnovel.com",
        "jobs-staging.thegreatnovel.com"
    ]

    static var baseURL: URL {
        guard let raw = UserDefaults.standard.string(forKey: "jobpilot.baseURL"),
              let url = URL(string: raw),
              url.scheme == "https",
              let host = url.host,
              supportedHosts.contains(host) else {
            return productionURL
        }
        return url
    }
}
