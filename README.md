# Patient Management System (P_M_S)

A modern, full-featured Patient & Clinic Queue Management Application built with **React**, **Vite**, and **Supabase**.

## 🚀 Features

- **Queue Management & Live Board**: Single-doctor & multi-patient clinic queue tracking with First-Come-First-Served (FCFS) sorting.
- **Receptionist Dashboard**: Quick patient check-in, real-time patient queue calling, and waitlist management.
- **Doctor Dashboard**: Consultation notes, medical records, and live status updates.
- **TV Waiting Room Screen**: Live token calling display with automatic voice (Text-to-Speech) announcements.
- **Realtime Sync**: Cross-tab (`BroadcastChannel`) & Supabase WebSocket synchronization.

## 🛠️ Getting Started

### 1. Prerequisites
- Node.js (v18+)
- npm or yarn

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/P_M_S.git

# Navigate into the project folder
cd P_M_S

# Install dependencies
npm install
```

### 3. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase project URL and anon key:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Database Setup (Supabase)
Run the SQL script provided in `supabase_schema.sql` inside your Supabase **SQL Editor**.

### 5. Running the Application
```bash
npm run dev
```

### 6. Building for Production
```bash
npm run build
```
