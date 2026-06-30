import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Colors

private extension Color {
    static let rcGreen   = Color(red: 0.133, green: 0.773, blue: 0.369)
    static let rcBlue    = Color(red: 0.231, green: 0.510, blue: 0.965)
    static let rcSurface = Color(red: 0.11,  green: 0.11,  blue: 0.13)
}

// MARK: - Item row (lock screen)

private struct ItemRow: View {
    let item: ShoppingItem
    let checked: Bool

    var body: some View {
        HStack(alignment: .center, spacing: 6) {
            Image(systemName: checked ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(checked ? .rcGreen : Color.white.opacity(0.35))
                .frame(width: 16)

            Text(item.name + (item.quantity.map { " — \($0)" } ?? ""))
                .font(.system(size: 12, weight: checked ? .regular : .medium))
                .foregroundColor(checked ? Color.white.opacity(0.35) : Color.white.opacity(0.9))
                .strikethrough(checked, color: Color.white.opacity(0.35))
                .lineLimit(1)

            Spacer(minLength: 0)

            Text("(\(item.initial))")
                .font(.system(size: 10))
                .foregroundColor(Color.white.opacity(0.4))
        }
    }
}

// MARK: - Lock screen banner

struct LockScreenView: View {
    let context: ActivityViewContext<RunCartActivityAttributes>

    private var items: [ShoppingItem] { context.state.items }
    private var checked: Set<String> { Set(context.state.checkedIds) }
    private var remaining: Int { items.filter { !checked.contains($0.id) }.count }
    private var total: Int { items.count }

    var body: some View {
        if context.state.isDone {
            doneView
        } else if items.count <= 8 {
            singleColumnView
        } else {
            twoColumnView
        }
    }

    private var singleColumnView: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            VStack(alignment: .leading, spacing: 2) {
                ForEach(items) { item in
                    ItemRow(item: item, checked: checked.contains(item.id))
                        .padding(.vertical, 2)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            footer
        }
        .background(Color.rcSurface)
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    private var twoColumnView: some View {
        let visible = Array(items.prefix(10))
        let overflow = items.count - 10

        return VStack(alignment: .leading, spacing: 0) {
            header
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 2) {
                ForEach(visible) { item in
                    ItemRow(item: item, checked: checked.contains(item.id))
                        .padding(.vertical, 2)
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 8)

            if overflow > 0 {
                Text("+ \(overflow) more — open RunCart to see all")
                    .font(.system(size: 10))
                    .foregroundColor(Color.white.opacity(0.35))
                    .italic()
                    .padding(.horizontal, 14)
                    .padding(.top, 2)
            }
            footer
        }
        .background(Color.rcSurface)
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    private var doneView: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "cart.badge.checkmark")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.rcBlue)
                Text(context.attributes.storeNames + " — Complete")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.white)
                Spacer()
                Text("DONE")
                    .font(.system(size: 9, weight: .bold))
                    .padding(.horizontal, 7).padding(.vertical, 2)
                    .background(Color.rcBlue)
                    .foregroundColor(.white)
                    .clipShape(Capsule())
            }
            .padding(.horizontal, 14).padding(.vertical, 10)

            VStack(spacing: 4) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 32))
                    .foregroundColor(.rcGreen)
                Text("All \(total) items picked up")
                    .font(.system(size: 13))
                    .foregroundColor(Color.white.opacity(0.8))
                Text("Closing…")
                    .font(.system(size: 11))
                    .foregroundColor(Color.white.opacity(0.4))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
        }
        .background(Color(red: 0.08, green: 0.16, blue: 0.08))
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    private var header: some View {
        HStack(spacing: 8) {
            Image(systemName: "cart.fill")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.rcGreen)
            Text(context.attributes.storeNames)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.white)
            Spacer()
            Text("\(remaining)/\(total)")
                .font(.system(size: 11, weight: .bold))
                .padding(.horizontal, 7).padding(.vertical, 2)
                .background(remaining == 0 ? Color.rcGreen : Color.white.opacity(0.15))
                .foregroundColor(remaining == 0 ? .black : .white)
                .clipShape(Capsule())
            Text("LIVE")
                .font(.system(size: 9, weight: .bold))
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(Color.rcGreen)
                .foregroundColor(.black)
                .clipShape(Capsule())
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .overlay(alignment: .bottom) {
            Divider().background(Color.white.opacity(0.07))
        }
    }

    private var footer: some View {
        let peopleCount = Set(items.map { $0.person }).count
        return HStack {
            Text("\(items.count) items · \(peopleCount) people")
                .font(.system(size: 10))
                .foregroundColor(Color.white.opacity(0.4))
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .overlay(alignment: .top) {
            Divider().background(Color.white.opacity(0.07))
        }
    }
}

// MARK: - Widget

struct RunCartWidgetsLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RunCartActivityAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(Color.rcSurface)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 4) {
                        Image(systemName: "cart.fill")
                            .font(.system(size: 11))
                            .foregroundColor(.rcGreen)
                        Text(context.attributes.storeNames)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(.white)
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.items.filter { !Set(context.state.checkedIds).contains($0.id) }.count)/\(context.state.items.count)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.rcGreen)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    let checked = Set(context.state.checkedIds)
                    let visible = Array(context.state.items.prefix(4))
                    VStack(alignment: .leading, spacing: 2) {
                        ForEach(visible) { item in
                            HStack(spacing: 5) {
                                Image(systemName: checked.contains(item.id) ? "checkmark.circle.fill" : "circle")
                                    .font(.system(size: 10))
                                    .foregroundColor(checked.contains(item.id) ? .rcGreen : Color.white.opacity(0.4))
                                Text(item.name)
                                    .font(.system(size: 11))
                                    .foregroundColor(checked.contains(item.id) ? Color.white.opacity(0.35) : Color.white.opacity(0.85))
                                    .strikethrough(checked.contains(item.id))
                                    .lineLimit(1)
                                Spacer()
                                Text("(\(item.initial))")
                                    .font(.system(size: 9))
                                    .foregroundColor(Color.white.opacity(0.35))
                            }
                        }
                        if context.state.items.count > 4 {
                            Text("+ \(context.state.items.count - 4) more")
                                .font(.system(size: 10))
                                .foregroundColor(Color.white.opacity(0.35))
                                .italic()
                        }
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                Image(systemName: "cart.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.rcGreen)
            } compactTrailing: {
                Text("\(context.state.items.filter { !Set(context.state.checkedIds).contains($0.id) }.count)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.rcGreen)
            } minimal: {
                Image(systemName: context.state.isDone ? "checkmark.circle.fill" : "cart.fill")
                    .font(.system(size: 12))
                    .foregroundColor(context.state.isDone ? .rcGreen : .white)
            }
        }
    }
}
