import ActivityKit
import Capacitor
import Foundation

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end",    returnType: CAPPluginReturnPromise),
    ]

    // Stored as Any to avoid compile-time availability errors on iOS 15 deployment target.
    // Holds Activity<RunCartActivityAttributes> at runtime on iOS 16.1+.
    private var currentActivity: Any?

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2+")
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("Live Activities not enabled by user")
            return
        }

        let runId      = call.getString("runId") ?? ""
        let storeNames = call.getString("storeNames") ?? "Shopping"
        let items      = parseItems(call.getArray("items") ?? [])
        let checkedIds = (call.getArray("checkedIds") ?? []).compactMap { $0 as? String }

        let attributes = RunCartActivityAttributes(runId: runId, storeNames: storeNames)
        let state = RunCartActivityAttributes.ContentState(
            items: items,
            checkedIds: checkedIds,
            isDone: false
        )

        do {
            let activity = try Activity<RunCartActivityAttributes>.request(
                attributes: attributes,
                content: ActivityContent(state: state, staleDate: nil),
                pushType: nil
            )
            currentActivity = activity
            call.resolve(["activityId": activity.id])
        } catch {
            call.reject("Failed to start Live Activity: \(error.localizedDescription)")
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2+")
            return
        }
        guard let activity = currentActivity as? Activity<RunCartActivityAttributes> else {
            call.reject("No active Live Activity")
            return
        }

        let items      = parseItems(call.getArray("items") ?? [])
        let checkedIds = (call.getArray("checkedIds") ?? []).compactMap { $0 as? String }
        let isDone     = call.getBool("isDone") ?? false

        let newState = RunCartActivityAttributes.ContentState(
            items: items,
            checkedIds: checkedIds,
            isDone: isDone
        )

        Task {
            await activity.update(ActivityContent(state: newState, staleDate: nil))
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2+")
            return
        }
        guard let activity = currentActivity as? Activity<RunCartActivityAttributes> else {
            call.resolve()
            return
        }

        let items      = parseItems(call.getArray("items") ?? [])
        let checkedIds = (call.getArray("checkedIds") ?? []).compactMap { $0 as? String }
        let finalState = RunCartActivityAttributes.ContentState(
            items: items,
            checkedIds: checkedIds,
            isDone: true
        )

        Task {
            await activity.end(
                ActivityContent(state: finalState, staleDate: nil),
                dismissalPolicy: .after(Date().addingTimeInterval(5))
            )
            self.currentActivity = nil
            call.resolve()
        }
    }

    private func parseItems(_ raw: [Any]) -> [ShoppingItem] {
        raw.compactMap { element -> ShoppingItem? in
            guard let dict    = element as? [String: Any],
                  let id      = dict["id"]      as? String,
                  let name    = dict["name"]    as? String,
                  let person  = dict["person"]  as? String,
                  let initial = dict["initial"] as? String
            else { return nil }
            return ShoppingItem(
                id: id,
                name: name,
                quantity: dict["quantity"] as? String,
                person: person,
                initial: initial
            )
        }
    }
}
