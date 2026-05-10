# GhostGallery System Architecture & Technical Specifications

Welcome to the complete engineering specifications for **GhostGallery**, a next-generation, privacy-preserving asset distribution and live web proxy framework. This document outlines every functional pillar, internal logic pipeline, and data flow in comprehensive detail.

---

## 🏛️ 1. Core Technology Stack

*   **Framework:** [Next.js 15] with App Router architecture and Turbopack.
*   **Language:** [TypeScript 5+] providing robust static typing across client and server boundaries.
*   **Database:** [Supabase PostgreSQL] handling relationship integrity, session locking, and token metadata.
*   **Object Storage:** [Vercel Blob] (Private Mode) used for non-public, binary content storage streams.
*   **Styling:** Hybrid Vanilla CSS variables combined with utility class architectures for high-performance dynamic animations.

---

## 📊 2. Database Schema & Entity Architecture

The engine relies on three primary relational tables ensuring atomicity across dynamic creation cycles:

### A. `galleries`
The master controller table storing global identity.
- `id`: UUID (Primary Key)
- `title`: Descriptive header.
- `watermark_text`: The dynamic string overlaid in visual viewports.
- `target_url`: Contains the raw URL if set to "Website Proxy Mode" (nullable).
- `user_id`: UUID linking to Supabase authenticated user (nullable for anonymous creation).
- `created_at`: Datetime stamp.

### B. `gallery_images`
The registry containing pointers to binary media locations.
- `id`: UUID
- `gallery_id`: Foreign key pointing to parent.
- `blob_pathname`: The private pathname stored inside Vercel Blob.
- `original_filename`: Preserves the source filename.
- `size_bytes` & `content_type`: Meta for transmission optimization.

### C. `share_links`
The security enforcement engine, controlling dynamic routing.
- `id`: UUID
- `gallery_id`: Target relation.
- `token`: High-entropy string (32 chars for direct, 6 chars for shortened redirects).
- `expires_at`: Critical constraint determining revocation time.
- `one_time_use`: Boolean flag enforcing session lockout after trigger.
- `access_count`: Integer monitoring entry volume.
- `session_id`: Captures the unique device footprint upon first access locking.

---

## 🛠️ 3. Complete API Subsystem Specifications

GhostGallery implements a collection of specialized, low-latency RESTful edge routes:

### 🟢 `POST /api/upload`
The ingestion pipeline responsible for initiating entries and processing multi-part streams.
- **Mode: `action: init`** — Spawns an empty `galleries` record and sets client-side ownership cookies.
- **Mode: `Binary Direct Stream`** — Intercepts raw data and pipes it directly into private Vercel Blobs bypassing transient filesystem buffers, ensuring rapid velocity.
- **Mode: `action: finalize`** — Assembles the gathered blob paths, inserts `gallery_images` in batch, generates both 32-character secure tokens and 6-character aliases.
- **Mode: `action: create_url`** — Skips image logic and directly maps a secured entity to an encrypted `target_url`.

### 🟢 `POST /api/validate-token`
The gatekeeper function authorizing every single connection request.
- Loads current link configuration based on the URL token.
- Evaluates dynamic clock thresholds ensuring present time <= `expires_at`.
- Cross-checks `one_time_use` status against `access_count`.
- Issues a secure, HTTP-Only `session_id` cookie marking the device "locked" to prevent distributed viewing attempts on one-time links.
- Returns finalized gallery structural payload excluding the real source URL.

### 🟢 `GET /api/gallery`
The administration portal logic.
- **Unbound (`/api/gallery`)**: Authenticated handler returning historical catalog for the current Supabase identity.
- **Bound (`?id=xxx`)**: Public collector assembling full tree for detailed presentation inside management consoles.

### 🔴 `DELETE /api/gallery`
Advanced secure revocation handler featuring adaptive privilege escalation.
1. Detects available `SUPABASE_SERVICE_ROLE_KEY` environment flags.
2. Upgrades to Administrative Client mode to bypass RLS completely for instant physical table pruning.
3. **Self-Healing Fallback:** If native RLS denies immediate deletion, it triggers an automated "Secure Expiration" sequence—rewriting associated `share_links.expires_at` to Unix epoch (Jan 1, 1970), rendering raw data mathematically inaccessible to any consumer globally instantly.

### 🔵 `GET /api/proxy-site/[...slug]`
The flagship invisible proxy tunneling system.
- Receives intercepted page and asset requests via `?token=` signature.
- Rewrites incoming paths using origin resolver lookup.
- Re-fetches content from the destination server server-side, stripping tracking and leaking headers (`Referrer`, `Host`).
- Feeds sanitized streams back to viewer keeping viewer completely decoupled from original address.

---

## 🎨 4. Visual & Interaction Subsystems (The UX Logic)

### 📸 Upload & Input Intelligence
- **Drag-and-Drop Aggregator:** Handles file drops.
- **Inter-Domain Snatch:** Special handler intercepts images dragged directly from other open browser websites into our canvas.
- **Clipboard Injection:** Direct global `paste` listener captures screenshots from system buffer instantaneously.
- **Horizontal Preview Dock:** Dynamically limits vertical expansion by converting long item-counts into stylish horizontal kinetic-scroll ribbons.

### 🛡️ Viewer Shield Layer (Anti-Piracy Suite)
- **Dynamic CSS Grid Overlay:** Injects a non-selectable `div` plane stacked highest in z-index running repetitive watermark text.
- **Event Trap Matrix:**
    - Blocks `contextmenu` (stops Right-Click).
    - Blocks `keydown` triggers like `Cmd+Shift+C`, `F12`, `Cmd+Option+J` to prevent inspector activation.
    - Blocks `dragstart` to prevent saving visual components to local drive.
- **CSS Shielding:** Utilizes `-webkit-user-select: none` and `user-drag: none` browser rules.

---

## 🛸 5. Advanced Persistence & Routing Flow

### 🔗 Link Translation Mechanism
Routes passing through `app/s/[code]` consult the `share_links` index, locate active pairings, and perform automatic `307 Temporary Redirect` jumps to the heavy validation routes (`/view/[token]`), providing user-friendly, short sharing links without compromising base security token density.

### 🗄️ Ownership Redundancy Strategy
To provide a seamless creator dashboard without forcing mandatory user accounts, GhostGallery implements **Triple-State Tracking**:
1. **Server Side:** An HTTP-only `created_galleries` cookie tracks server identity.
2. **Browser Side:** `localStorage.ghost_galleries` preserves listing hierarchy instantly between refreshes.
3. **Exclusion Filter Blocklist:** A specialized `localStorage.ghost_deleted_galleries` ledger ensures archived items maintain **zero visibility**, immediately suppressing any accidental legacy rows served back by backend synchronization, providing 100% consistency in UI state management.

---

### ⚖️ Summary of Safety Guarantees
*   **Zero Leakage:** The client browser NEVER touches raw source storage or raw destination hostnames directly.
*   **Tamper Proof:** Attempts to tamper with parameters invalidates checksum integrity checks in server actions.
*   **Volatile Session:** Once configured duration lapses, the data reference technically invalidates globally.

*Document version 1.0.0*
