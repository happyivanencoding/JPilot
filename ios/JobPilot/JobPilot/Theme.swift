import SwiftUI

enum JobPilotTheme {
    static let primary = Color(red: 22 / 255, green: 101 / 255, blue: 104 / 255)
    static let primaryContainer = Color(red: 227 / 255, green: 239 / 255, blue: 236 / 255)
    static let background = Color(red: 243 / 255, green: 245 / 255, blue: 243 / 255)
    static let surface = Color.white
    static let text = Color(red: 28 / 255, green: 48 / 255, blue: 55 / 255)
    static let muted = Color(red: 86 / 255, green: 102 / 255, blue: 117 / 255)
}

struct JobPilotPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.vertical, 14)
            .background(JobPilotTheme.primary.opacity(configuration.isPressed ? 0.82 : 1), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
    }
}
