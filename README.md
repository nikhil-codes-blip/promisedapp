# 🌍 Public Promise Registry - Web3 dApp

A decentralized-style application that allows users to publicly commit to promises and track their completion.  
Data is stored on **Supabase** with **MetaMask wallet integration** for identity and signing.  

---

## ✨ Features

- 📌 **Promise Tracking**: Create and track promises with deadlines and optional proof.  
- ⭐ **Reputation System**: Earn reputation for completed promises.  
- ⏱ **Status Tracking**: Monitor promises as active, completed, or failed.  
- 🎨 **Modern UI**: A responsive interface with a dark theme and animations.  
- 🔑 **Wallet Integration**: Connect with MetaMask to interact with the dApp.  
- ⚡ **Realtime Updates**: Automatic updates via Supabase Realtime.  

---

## 🏗️ Architecture  

### 🔹 Backend (Next.js API Routes + Supabase)  
- ⚙️ **API Endpoints**: Handle promise creation, updates, and user data.  
- 🗄 **Database**: Supabase (PostgreSQL) for persistence.  
- 🔒 **Authentication**: Wallet-based identity + Supabase user records.  
- 🔔 **Realtime**: Supabase Realtime for live updates.  

### 🔹 Frontend (Next.js + React)  
- 📊 **Promise Dashboard**: Manage all promises.  
- 📝 **Create Promise Form**: Submit new promises.  
- ✅ **Status Updates**: Mark promises as completed or failed.  
- 👛 **Wallet Integration**: Connect with MetaMask.  
- 📈 **Progress Tracking**: Visual progress bars and deadlines.  

---

## 🚀 Quick Start  

### 📋 Prerequisites  
- Node.js 18+  
- npm or yarn  
- Supabase project (URL + anon key)  

### ⚡ 1. Clone and Install  
```bash
git clone <https://github.com/nikhil-codes-blip/promisedapp.git>
cd public-promise-registry
npm install
```
### ⚡ 2. Setup Environment
Copy the example file:

```bash
cp .env.example .env.local
```
Edit .env.local with your Supabase configuration:

```ini
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_APP_NAME=Promise Registry
NEXT_PUBLIC_CHAIN_ID=1
```
### ⚡ 3. Start Frontend
```bash
npm run dev
```
Visit 👉 http://localhost:3000

### 📱 Mobile Usage
📲 Install MetaMask from App Store or Google Play.

🔑 Create/Import Wallet.

🌐 Open MetaMask Browser.

🔗 Access Project: Paste deployed URL.

✅ Connect Wallet and start using.

### 🖥 Desktop Usage
✍️ **Creating a Promise**
- 👛 Connect Wallet.
- ➕ Create Promise via button.
- 📝 Fill Details:
  - Description (max 200 chars)
  - Deadline (future date/time)
  - Optional proof URL
- ✨ Submit: Sign the transaction in MetaMask.

🔄 **Managing Promises**
- 📊 View Dashboard with statuses.
- 🛠 Update Status: Mark as completed or failed.

🎖 **Reputation System**
- ✅ +1 point per completed promise
- ❌ -2 points per failed promise
- 🏅 Badges for milestones

---

## 🛠 Development
### 📂 Project Structure
```
├── components.json
├── eslint.config.mjs
├── gitkey
├── gitkey.pub
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.js
├── README.md
├── supabase_rpc_function.sql
├── tailwind.config.js
├── tailwind.config.ts
├── tsconfig.json

├── app/
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx

├── components/
│   ├── metamask-connector.tsx
│   ├── promise-card.tsx
│   ├── promise-stats.tsx
│   └── wallet-connect.tsx

├── lib/
│   ├── blockchain-service.ts
│   ├── realtime-service.ts
│   ├── supabase-auth.ts
│   ├── supabase-client.ts
│   └── utils.ts

├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── logo.png
│   ├── my-icon.jpg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg

├── scripts/
│   └── fix-user-reputation.ts

├── sql/
│   ├── get_global_stats.sql
│   ├── increment_column.sql
│   └── update_promise_status.sql

└── types/
    └── index.ts

```
### 🔑 Key Components
- `app/page.tsx`: Main dashboard
- `components/metamask-connector.tsx`: Wallet connection
- `components/promise-card.tsx`: Displays promise info
- `lib/realtime-service.ts`: Supabase queries + realtime updates
- `lib/blockchain-service.ts`: Placeholder for future blockchain integration

---

## 🧪 Testing
- 🧩 Runs in mock mode by default, no blockchain needed.
- 🖥 Test the UI + Supabase functionality locally.

---

## 🚀 Deployment
### 🚄 Railway (Recommended)
1. Push repo to GitHub.
2. Create a project on Railway.
3. Connect GitHub repo.
4. Add environment variables in Railway → Variables tab.
5. Railway provides free `*.up.railway.app` domain.
6. (Optional) Add a custom domain.

### 💻 Local
```bash
npm run build
npm start
```
Visit 👉 http://localhost:3000

---

## 🤝 Contributing
1. 🍴 Fork repo
2. 🌱 Create a feature branch
3. ✏️ Make changes
4. ✅ Test thoroughly
5. 🔄 Submit PR

---

## 📄 License
MIT License - see `LICENSE` file

---

## 🆘 Support
Open an issue on GitHub for bugs, requests, or questions.

---

💙 Built with Next.js, Supabase, TailwindCSS, and MetaMask
