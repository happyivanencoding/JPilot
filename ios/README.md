# JobPilot iOS

This directory contains the iPhone app shell for the latest `main` product.

The native app intentionally hosts the current phone-first JobPilot web product in `WKWebView`. That keeps the five main tabs, onboarding, invite-code flow, authentication, CV upload, job matching, applications, interview preparation, profile, settings, quiz, and all existing API behavior aligned with `main` instead of maintaining a second implementation that can drift.

## Open and run

1. Open `ios/JobPilot/JobPilot.xcodeproj` in Xcode on macOS.
2. Select an iPhone simulator or a connected iPhone.
3. Select the `JobPilot` scheme and press Run.

The production URL is the default: `https://jobs.thegreatnovel.com/`.

The app only accepts the production and staging HTTPS hosts from `AppConfig.swift`. A debug build can select staging by setting the `jobpilot.baseURL` UserDefaults value to `https://jobs-staging.thegreatnovel.com/`.

## Native integrations

- CV/document uploads use the iOS document picker and return the selected file to the existing web upload flow.
- Web authentication and app state stay inside one `WKWebView` cookie store.
- Non-web URL schemes are handed to iOS; web navigation stays in the app so login and product state remain consistent.
- Pull-to-refresh is available through the web page's native scroll view, and swipe-back/forward gestures are enabled.

## Build requirement

The project targets iOS 16 or later and requires Xcode with the iOS SDK. This repository environment does not include a configured Xcode toolchain, so final simulator/device compilation must be run on a Mac with Xcode installed.
