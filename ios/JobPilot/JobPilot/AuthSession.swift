import Foundation
import Combine
import UIKit
import WebKit

@MainActor
final class AuthSession: ObservableObject {
    enum State: Equatable {
        case signedOut
        case starting
        case waitingForBrowser
        case signedIn
        case failed(String)
    }

    @Published private(set) var state: State

    private let tokenKey = "jobpilot.sessionToken"
    private let api = JobPilotAPI()
    private var loginTask: Task<Void, Never>?

    init() {
        state = UserDefaults.standard.string(forKey: tokenKey)?.isEmpty == false ? .signedIn : .signedOut
    }

    deinit {
        loginTask?.cancel()
    }

    func beginLogin() {
        loginTask?.cancel()
        loginTask = Task { [weak self] in
            guard let self else { return }
            await self.performLogin()
        }
    }

    func logout() {
        loginTask?.cancel()
        loginTask = nil
        UserDefaults.standard.removeObject(forKey: tokenKey)
        Task { await WebSessionCookie.clear() }
        state = .signedOut
    }

    private func performLogin() async {
        do {
            state = .starting
            let start = try await api.startMobileLogin()
            guard let requestID = start["requestId"] as? String,
                  let verifier = start["verifier"] as? String,
                  let rawURL = start["url"] as? String,
                  let loginURL = URL(string: rawURL) else {
                throw AuthError.invalidResponse
            }

            let opened = await UIApplication.shared.open(loginURL, options: [:])
            guard opened else {
                throw AuthError.browserUnavailable
            }
            state = .waitingForBrowser

            for _ in 0..<180 {
                try Task.checkCancellation()
                try await Task.sleep(nanoseconds: 2_500_000_000)
                let result = try await api.exchangeMobileLogin(requestID: requestID, verifier: verifier)
                if let token = result["token"] as? String, !token.isEmpty {
                    UserDefaults.standard.set(token, forKey: tokenKey)
                    try await WebSessionCookie.store(token: token)
                    state = .signedIn
                    return
                }
            }
            throw AuthError.expired
        } catch is CancellationError {
            return
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

}

private enum AuthError: LocalizedError {
    case invalidResponse
    case browserUnavailable
    case expired

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "登录服务返回了无效结果。"
        case .browserUnavailable: return "无法打开系统浏览器。"
        case .expired: return "登录等待已过期，请重新开始。"
        }
    }
}

@MainActor
enum WebSessionCookie {
    private static let cookieName = "jobpilot_session"

    static func store(token: String) async throws {
        guard let host = AppConfig.webBaseURL.host,
              let cookie = HTTPCookie(properties: [
                .domain: host,
                .path: "/",
                .name: cookieName,
                .value: token,
                .secure: "TRUE",
                .expires: Date(timeIntervalSinceNow: 30 * 24 * 60 * 60)
              ]) else { throw AuthError.invalidResponse }
        await withCheckedContinuation { continuation in
            WKWebsiteDataStore.default().httpCookieStore.setCookie(cookie) {
                continuation.resume()
            }
        }
    }

    static func clear() async {
        let cookies = await withCheckedContinuation { continuation in
            WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cookies in
                continuation.resume(returning: cookies)
            }
        }
        for cookie in cookies where cookie.name == cookieName && cookie.domain.contains(AppConfig.webBaseURL.host ?? "") {
            await withCheckedContinuation { continuation in
                WKWebsiteDataStore.default().httpCookieStore.delete(cookie) {
                    continuation.resume()
                }
            }
        }
    }
}
