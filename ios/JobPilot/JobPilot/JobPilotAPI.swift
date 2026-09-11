import Foundation

/// iOS talks only to JobPilot's backend. Model providers and their credentials
/// stay behind the backend/LLM proxy, just like Android.
final class JobPilotAPI {
    let baseURL: URL

    init(baseURL: URL = AppConfig.apiBaseURL) {
        self.baseURL = baseURL
    }

    func request(
        path: String,
        method: String = "GET",
        body: [String: Any]? = nil,
        profileID: String? = nil,
        token: String? = nil
    ) async throws -> [String: Any] {
        guard path.hasPrefix("/"), !path.hasPrefix("//"),
              let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw JobPilotAPIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("JobPilot-iOS/\(AppConfig.version)", forHTTPHeaderField: "X-JobPilot-Client")
        request.setValue(Locale.current.language.languageCode?.identifier ?? "en", forHTTPHeaderField: "X-JobPilot-Locale")
        if let profileID, !profileID.isEmpty {
            request.setValue(profileID, forHTTPHeaderField: "X-JobPilot-Profile")
        }
        if let token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpMethod = method == "GET" ? "POST" : method
            request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw JobPilotAPIError.invalidResponse
        }

        let value = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard (200..<300).contains(http.statusCode) else {
            let message = value["error"] as? String
                ?? (http.statusCode == 302 ? "JobPilot 登录已过期。" : "JobPilot API 请求失败（HTTP \(http.statusCode)）。")
            throw JobPilotAPIError.server(status: http.statusCode, message: message)
        }
        return value
    }

    func startMobileLogin() async throws -> [String: Any] {
        try await request(path: "/api/mobile-auth/start", method: "POST", body: [:])
    }

    func exchangeMobileLogin(requestID: String, verifier: String) async throws -> [String: Any] {
        try await request(
            path: "/api/mobile-auth/exchange",
            method: "POST",
            body: ["requestId": requestID, "verifier": verifier]
        )
    }

    func snapshot(profileID: String? = nil, token: String? = nil) async throws -> [String: Any] {
        try await request(path: "/api/mobile", profileID: profileID, token: token)
    }
}

enum JobPilotAPIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case server(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "JobPilot API 地址无效。"
        case .invalidResponse:
            return "JobPilot API 返回了无效结果。"
        case .server(_, let message):
            return message
        }
    }
}
