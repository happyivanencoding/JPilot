import SwiftUI

struct RootView: View {
    @State private var state: LoadState = .loading
    @State private var reloadID = UUID()

    var body: some View {
        ZStack {
            WebContainer(
                url: AppConfig.baseURL,
                reloadID: reloadID,
                onLoadStateChange: { state = $0 }
            )
            .ignoresSafeArea(.container, edges: [.bottom])

            switch state {
            case .loading:
                LoadingView()
                    .transition(.opacity)
            case .failed(let message):
                OfflineView(message: message) {
                    withAnimation(.easeInOut(duration: 0.18)) {
                        state = .loading
                        reloadID = UUID()
                    }
                }
                .transition(.opacity)
            case .ready:
                EmptyView()
            }
        }
        .background(JobPilotTheme.background)
        .preferredColorScheme(nil)
    }
}

enum LoadState: Equatable {
    case loading
    case ready
    case failed(String)
}

private struct LoadingView: View {
    var body: some View {
        ZStack {
            JobPilotTheme.background.ignoresSafeArea()
            VStack(spacing: 18) {
                BrandMark()
                Text("JobPilot")
                    .font(.system(size: 25, weight: .semibold, design: .rounded))
                    .foregroundStyle(JobPilotTheme.text)
                ProgressView()
                    .tint(JobPilotTheme.primary)
                    .padding(.top, 6)
                Text("正在连接你的工作台…")
                    .font(.footnote)
                    .foregroundStyle(JobPilotTheme.muted)
            }
        }
    }
}

private struct OfflineView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        ZStack {
            JobPilotTheme.background.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 16) {
                BrandMark()
                Text("暂时无法打开 JobPilot")
                    .font(.system(size: 25, weight: .semibold, design: .rounded))
                    .foregroundStyle(JobPilotTheme.text)
                Text("请检查网络连接。你的账号数据仍保存在服务器上，恢复连接后可以继续使用。")
                    .font(.body)
                    .foregroundStyle(JobPilotTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
                Text(message)
                    .font(.caption)
                    .foregroundStyle(JobPilotTheme.muted)
                    .lineLimit(3)
                Button(action: retry) {
                    Label("重新连接", systemImage: "arrow.clockwise")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(JobPilotPrimaryButtonStyle())
            }
            .padding(26)
            .background(JobPilotTheme.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .padding(22)
        }
    }
}

private struct BrandMark: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .fill(JobPilotTheme.primary)
            Image(systemName: "paperplane.fill")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(.white)
                .rotationEffect(.degrees(-12))
        }
        .frame(width: 48, height: 48)
        .accessibilityLabel("JobPilot")
    }
}
