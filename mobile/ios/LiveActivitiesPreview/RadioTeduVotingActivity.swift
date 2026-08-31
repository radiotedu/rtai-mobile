import ActivityKit
import Foundation

@available(iOS 16.1, *)
struct RadioTeduVotingActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    let title: String
    let endsAt: Date
    let active: Bool
  }

  let roundID: String
}

@available(iOS 16.1, *)
enum RadioTeduVotingActivityController {
  static func start(roundID: String, title: String, endsAt: Date) async throws -> String {
    let activity = try Activity<RadioTeduVotingActivityAttributes>.request(
      attributes: .init(roundID: roundID),
      content: .init(state: .init(title: title, endsAt: endsAt, active: true), staleDate: endsAt),
      pushType: nil
    )
    return activity.id
  }

  static func finishAll() async {
    for activity in Activity<RadioTeduVotingActivityAttributes>.activities {
      await activity.end(
        .init(state: .init(title: "RadioTEDU Voting", endsAt: .now, active: false), staleDate: nil),
        dismissalPolicy: .immediate
      )
    }
  }
}
