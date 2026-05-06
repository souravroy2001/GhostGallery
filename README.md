# ⬡ Ghost Gallery

> **Secure, Time-Limited, One-Time Photo Sharing with Dynamic Watermarks**

Ghost Gallery is a state-of-the-art secure image delivery platform designed for photographers, designers, and privacy-conscious professionals. It allows you to share collections of photos with time-bound, single-use links that automatically expire and prevent unauthorized distribution.

---

## ✦ Features

- 🛡 **One-Time Access Policy**: Links automatically destroy themselves after their first viewing session. Subsequent visits—even with manual `?preview=true` bypass attempts—are strictly rejected.
- ⚡ **Lightning-Fast Image Delivery**: Optimized with private browser memory caching and parallelized database-to-storage fetch streams (`Promise.all`), cutting image load times by nearly 40%.
- ◈ **Dynamic Session-Bound Watermarks**: Applies non-destructive, real-time diagonal tiled watermarks combining your custom text, the recipient's unique Session ID (SID), and a precise local timestamp directly onto a secure HTML5 Canvas.
- ⬡ **Active Tab Guard (Focus Protection)**: Instantly blurs and hides the gallery contents with a secure lock mask if the recipient switches browser tabs, minimizes the window, or loses focus on the page.
- 🛡 **Anti-Piracy & Theft Safeguards**: Disables mouse right-clicks, drag-and-drop actions, standard browser save-as keys (`Ctrl+S`/`Cmd+S`), print keys (`Ctrl+P`/`Cmd+P`), and print screen capture.
- 🕒 **Flexible Expiry Configurations**: Senders can customize gallery lifetimes ranging from 1 hour, 24 hours, to 7 days, complete with warning banners and real-time countdown clocks.
- 🎨 **Sleek Cyber-Futuristic Aesthetics**: Designed with premium typography, responsive layouts, neon glows, and custom-designed system status screens (Loading, Used, Expired, and Unverified).

---

## ⚙ Tech Stack

- **Framework**: [Next.js (App Router)](https://nextjs.org/)
- **Database**: [Supabase PostgreSQL](https://supabase.com/)
- **Storage**: [Vercel Blob Storage](https://vercel.com/docs/storage/vercel-blob)
- **Styling**: Vanilla CSS with modern HSL tailormade variables and custom CSS keyframe micro-animations.

---

## ▶ Quick Start

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd privatePhotoShare
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory and add your secret keys:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Vercel Blob Token
BLOB_READ_WRITE_TOKEN=your-vercel-blob-read-write-token
```

### 3. Initialize Database
Execute the SQL instructions located in `supabase_setup.sql` inside your Supabase SQL Editor. This will provision:
- `galleries` table (holds titles and watermark text)
- `gallery_images` table (maps uploaded files to their private storage pathnames)
- `share_links` table (handles time expiries, access limits, and session ID bindings)

### 4. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to start uploading and sharing securely.

---

## ⬡ Project Structure

```text
├── app/
│   ├── api/
│   │   ├── image/            # High-performance parallel private photo serving endpoint
│   │   ├── upload/           # Handles Vercel Blob uploads & metadata database registration
│   │   └── validate-token/   # Crypto-token verification & single-use policy enforcement
│   ├── view/                 # Recipient's secure secure-viewing-session page
│   └── globals.css           # Custom-themed CSS Variables & animations
├── components/
│   ├── image-viewer.tsx      # Core recipient viewer, canvas drawing, and focus protection hooks
│   ├── upload-form.tsx       # Sender dashboard, custom watermarks, and duration picker
│   └── share-link-display.tsx# Beautiful share link generation dashboard
└── supabase_setup.sql        # Database initialization script
```

---

## 🛡 Security Notice

Ghost Gallery provides client-side protections (like key/right-click disabling and tab blur overlays) combined with robust server-side cryptographic token validation to significantly deter casual sharing and image piracy. However, no web-based viewer can completely prevent analog captures (like a physical camera photo of a monitor). Senders are encouraged to use the **Watermark Security** system with clear recipient identifiers for complete accountability.
