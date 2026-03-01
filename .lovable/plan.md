

# 🛒 Group Order Runner — Mobile App Plan

## Overview
A native mobile app that lets a friend group coordinate store runs. When someone is heading to a store, they create a group order that notifies everyone. Friends add their orders before the timer runs out, and the runner gets a consolidated shopping list to work through.

---

## Core Features

### 1. Authentication & User Setup
- Sign up / log in (email + password, or social login)
- User profile with display name and optional avatar
- **Friend groups**: Create or join a group (via invite code/link) so notifications only go to your circle

### 2. Create a Store Run (Runner Flow)
- Tap a prominent **"I'm heading out!"** button
- Fill in:
  - **Store name(s)** being visited (e.g., "Costco, Trader Joe's")
  - **Order window** — how long friends have to submit (e.g., 30 min countdown)
  - **Optional limits**: max orders per person, or total order cap
  - Optional note (e.g., "No frozen items, trunk is small")
- Confirm → push notification sent to all group members

### 3. Order Submission (Friend Flow)
- Friends receive a push notification: *"Alex is heading to Costco! Add your order"*
- Open the app → see the active run with a **live countdown timer** pinned at the top
- Add items:
  - Item name
  - Quantity
  - Optional comment (e.g., "the blue bag, not red")
- Submit order before the timer expires
- Can edit/update their order until the window closes
- Runner gets a real-time notification each time someone submits

### 4. Consolidated Order View (Runner at the Store)
- Single scrollable list of **all items** grouped by store
- Each item shows: item name, quantity, who ordered it, and any comments
- **Checkbox** next to each item — runner taps to mark as picked up
- Option to **mark an entire person's order as done** at once
- Friends can see live status of their items (picked up ✓ or pending)

### 5. Live Timer & Status
- Persistent countdown timer visible across all screens during an active run
- Run status flow: **Open → Closed (timer up) → Shopping → Completed**
- Friends see when the run moves to "Shopping" and when their items are checked off

### 6. Notifications
- Push notifications via Capacitor for:
  - New run created
  - Order submitted (to runner)
  - Items picked up (to the person who ordered)
  - Run completed

### 7. Order History
- Past runs with summary: date, store, who ran, what was ordered
- Useful for reordering common items

---

## Design & UX
- **Mobile-first** design optimized for one-handed use
- Clean, card-based UI with bold colors for status indicators
- Large tap targets for use while walking around a store
- The consolidated order list is designed to be **glanceable** — no navigation needed while shopping

---

## Tech Approach
- **Frontend**: React + TypeScript with Tailwind CSS (mobile-optimized)
- **Backend**: Supabase (via Lovable Cloud) for auth, database, and real-time updates
- **Native wrapper**: Capacitor for iOS/Android with push notifications
- **Real-time**: Supabase real-time subscriptions for live order updates and timer sync

---

## Pages
1. **Login / Sign Up** — authentication screen
2. **Home** — active runs + "I'm heading out" button + group info
3. **Create Run** — form to set up store, timer, limits
4. **Active Run (Friend view)** — timer + add/edit order items
5. **Active Run (Runner view)** — consolidated checklist of all orders
6. **Run History** — past completed runs
7. **Group Management** — invite friends, manage your group
8. **Profile / Settings** — display name, notification preferences

