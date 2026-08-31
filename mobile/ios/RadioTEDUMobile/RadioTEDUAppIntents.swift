import AppIntents
import Foundation

@available(iOS 16.0, *)
enum RadioTEDUStationIntentValue: String, AppEnum, CaseIterable {
  case main = "radiotedu-main"
  case classic = "radiotedu-classic"
  case jazz = "radiotedu-jazz"
  case lofi = "radiotedu-lofi"
  case rock = "radiotedu-rock"
  case energize = "radiotedu-energize"
  case voting = "radiotedu-spark"
  case english = "radiotedu-en"
  case french = "radiotedu-fr"

  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "RadioTEDU station")

  static var caseDisplayRepresentations: [Self: DisplayRepresentation] = [
    .main: "RadioTEDU",
    .classic: "RadioTEDU Classic",
    .jazz: "RadioTEDU Jazz",
    .lofi: "RadioTEDU Lo-Fi",
    .rock: "RadioTEDU Rock",
    .energize: "RadioTEDU Energize",
    .voting: "RadioTEDU Voting",
    .english: "RadioTEDU English",
    .french: "RadioTEDU Français",
  ]
}

@available(iOS 16.0, *)
private enum RadioTEDUAppIntentRouter {
  static let pendingURLKey = "radiotedu.pending_app_intent_url"

  static func enqueue(_ path: String) {
    UserDefaults.standard.set("radiotedu://\(path)", forKey: pendingURLKey)
  }
}

@available(iOS 16.0, *)
struct PlayRadioTEDUIntent: AppIntent {
  static var title: LocalizedStringResource = "Play RadioTEDU"
  static var description = IntentDescription("Plays a RadioTEDU live station in the app.")
  static var openAppWhenRun = true

  @Parameter(title: "Station", default: .main)
  var station: RadioTEDUStationIntentValue

  func perform() async throws -> some IntentResult & ProvidesDialog {
    RadioTEDUAppIntentRouter.enqueue("play/\(station.rawValue)")
    return .result(dialog: "Opening RadioTEDU.")
  }
}

@available(iOS 16.0, *)
struct OpenRadioTEDUPodcastsIntent: AppIntent {
  static var title: LocalizedStringResource = "Open RadioTEDU Podcasts"
  static var description = IntentDescription("Opens the RadioTEDU podcast library.")
  static var openAppWhenRun = true

  func perform() async throws -> some IntentResult & ProvidesDialog {
    RadioTEDUAppIntentRouter.enqueue("podcasts")
    return .result(dialog: "Opening RadioTEDU podcasts.")
  }
}

@available(iOS 16.0, *)
struct OpenRadioTEDUVotingIntent: AppIntent {
  static var title: LocalizedStringResource = "Open RadioTEDU Voting"
  static var description = IntentDescription("Opens the active RadioTEDU song vote.")
  static var openAppWhenRun = true

  func perform() async throws -> some IntentResult & ProvidesDialog {
    RadioTEDUAppIntentRouter.enqueue("voting")
    return .result(dialog: "Opening RadioTEDU Voting.")
  }
}

@available(iOS 16.0, *)
struct RadioTEDUAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: PlayRadioTEDUIntent(),
      phrases: [
        "Play \(.applicationName)",
        "Listen to \(.applicationName)",
      ],
      shortTitle: "Play RadioTEDU",
      systemImageName: "radio"
    )
    AppShortcut(
      intent: OpenRadioTEDUPodcastsIntent(),
      phrases: [
        "Open podcasts in \(.applicationName)",
      ],
      shortTitle: "RadioTEDU Podcasts",
      systemImageName: "mic"
    )
    AppShortcut(
      intent: OpenRadioTEDUVotingIntent(),
      phrases: [
        "Open voting in \(.applicationName)",
      ],
      shortTitle: "RadioTEDU Voting",
      systemImageName: "checkmark.circle"
    )
  }
}
