# ⬡ GhostGallery

> **Next-Generation, Privacy-Preserving Asset Distribution & Stealth Live Web Proxy Architecture**

GhostGallery is an industrial-grade, privacy-first secure sharing platform that allows users to share confidential visual media collections and live web application links behind cryptographically secured, tokenized wrappers with dynamic session shielding, automated self-destruction, and invisible forwarding tunnels.

---

## 🏛️ 1. Core Technology Stack

*   **Framework:** [Next.js 15] with App Router and Turbopack for edge-optimized execution.
*   **Language:** [TypeScript 5+] delivering flawless cross-boundary structural enforcement.
*   **Database:** [Supabase PostgreSQL] ensuring relational integrity and dynamic clock synchronization.
*   **Object Storage:** [Vercel Blob] (Private Vault Mode) for non-public, signed stream pipelining.
*   **Styling:** High-performance Vanilla CSS Variables with native keyframe physics engine.

---

## 🛡️ 2. System Features & Capabilities

### 🕵️‍♂️ Advanced Invisible URL Proxy Tunneling
Securely share internal dashboards, development links, or restricted web applications.
- Viewer interacts with a live, fully functional destination through an isolated iframe stack.
- The raw target host address is **NEVER** revealed to browsers or client logs.
- Backwards traffic redirection keeps source domains mathematically protected.

### 📸 Sophisticated Media Ingestion
- **Smart Drag-and-Drop Aggegration:** Direct file interception supporting massive arrays of media.
- **Inter-Domain Drag Snatching:** Intercepts visual blobs directly pulled from alternate tabs and websites natively.
- **System Buffer Clipboard Injection:** Paste screenshots direct from system clipboard (`Ctrl+V`/`Cmd+V`) flawlessly.
- **Horizontal Kinetic Viewports:** Replaces standard lists with intelligent, horizontal scrolling preview docks ensuring layouts don't break with high loads.

### 🛡️ High-Profile User Shield (Anti-Leak Tech)
- **Session-Bound Watermarking:** Un-removable, semi-transparent tiled grid injected mathematically dynamically over the entire visual stack.
- **Interactive Event Blockage:** Absolute hard-cancellation of `contextmenu` (Right-click), keyboard shortcut triggers (`F12`, `Ctrl+Shift+I`), and drag-starts.
- **Tab Guard Blurring:** Instantly blurs context content when viewfocus is broken or minimize actions occur.

### ⏳ Secure Lifecycle Tokens
- Generates randomized 32-char secure seeds + human-readable 6-char redirection codes.
- **Single-Usage Locking:** Couples distinct viewing sessions to `session_id` browser cookies ensuring secondary browsers are hard-rejected upon return.
- **Custom Time Depletion:** Clock timers expiring assets anywhere from 1 to 168 hours globally.

---

## 📊 3. Database Schema & Architecture

The system guarantees reliability using highly coupled Postgres relations:

### A. `galleries`
Central identity store. Contains global settings, user binding, and encrypted URL maps.
### B. `gallery_images`
Mapping registry recording direct private pointers back to binary paths stored inside secure blobs.
### C. `share_links`
The heavy-logic policy registry regulating real-time dynamic accessibility via expirations, single-view thresholds, and session locks.

---

## 🛠️ 4. Subsystem API Mapping

| Method | Endpoint | Role |
| :--- | :--- | :--- |
| `POST` | `/api/upload` | Ingests bin-streams; generates encryption tokens & shortened codes. |
| `POST` | `/api/validate-token` | Main gateway; ensures clock alignment & performs device-locking. |
| `GET` | `/api/gallery` | Populates dashboard histories & provides specific item drilldowns. |
| `DELETE`| `/api/gallery` | Initiates cascade removal with **Admin Escalation** and **Secure Revoke** safe-guards. |
| `GET` | `/api/proxy-site` | Executes backchannel asset fetching for masked website relay tunnels. |

---

## 🛸 5. Persistence & Data Consistency Engine

GhostGallery guarantees a completely frictionless user experience using a proprietary **Triple-State Visibility Strategy**:

1.  **Ownership Tracking:** Maintains explicit authorization through signed server-side HTTP cookies (`created_galleries`).
2.  **Local Index Caching:** Preserves interface layout continuity immediately via browser `localStorage`.
3.  **Inertial Suppression Ledger:** A specialized local client-blocklist prevents ghost-records or archive-leakage from resurrecting on visual refreshes, preserving 100% interface integrity upon confirmed deletions.

---

## ▶ Quick Start Setup

### 1. Install Foundations
```bash
npm install
```

### 2. Synchronize Configuration
Construct `.env.local` utilizing your unique identifiers:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_URL.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
# OPTIONAL: Add this to enable instantaneous physical deletions bypassing RLS automatically.
SUPABASE_SERVICE_ROLE_KEY=YOUR_SECRET_KEY

# Storage
BLOB_READ_WRITE_TOKEN=YOUR_VERCEL_BLOB_TOKEN
```

### 3. Ignite
```bash
npm run dev
```

---

*🔒 Technical Integrity Confirmed. Standard operating manual version 2.0.0*
