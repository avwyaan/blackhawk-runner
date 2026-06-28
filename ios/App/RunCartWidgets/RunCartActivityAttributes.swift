import ActivityKit
import Foundation

struct ShoppingItem: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    var quantity: String?
    var person: String
    var initial: String
}

struct RunCartActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var items: [ShoppingItem]
        var checkedIds: [String]
        var isDone: Bool
    }

    var runId: String
    var storeNames: String
}
