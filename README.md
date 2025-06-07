# TipMaster

TipMaster is a modern tipping application that leverages cryptocurrency for fast, secure, and low-cost transactions. It's built with a React frontend, Firebase for backend services, and integrates with the Base network for USDC payments.

## Key Features

- **Wallet-Based Authentication**: Seamlessly sign up and log in using MetaMask or any WalletConnect-compatible wallet.
- **User Profiles & Avatars**: Staff members can create a profile and upload a custom avatar.
- **QR Code Tipping**: Each staff member gets a unique QR code. Customers can scan it to open a tipping page.
- **USDC on Base**: Tips are processed in USDC on the Base network, ensuring stable value and minimal transaction fees.
- **Transaction Dashboard**: Staff can view their tipping history, total earnings, and other key statistics.
- **Manual Tip Sending**: Customers can send tips directly to a staff member's wallet address without needing a QR code.
- **Progressive Web App (PWA)**: Installable on mobile devices for a native app-like experience.
- **Secure & Decentralized**: Users maintain full control over their funds. Private keys are never stored on our servers.

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Blockchain Integration**: `wagmi`, `viem` for wallet interactions.
- **Backend**: Firebase Cloud Functions (Node.js, TypeScript)
- **Database**: Firestore
- **Storage**: Firebase Cloud Storage for avatars.
- **Deployment**: Firebase Hosting

## Local Development Setup

Follow these steps to run the project locally.

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Firebase CLI

### 1. Clone the repository

```bash
git clone https://github.com/vlgalib/tipmaster.git
cd tipmaster
```

### 2. Setup Frontend

```bash
cd frontend
npm install
# Create a .env.local file and add your Firebase and WalletConnect config
# VITE_WALLETCONNECT_PROJECT_ID=...
# VITE_FIREBASE_API_KEY=...
# VITE_FIREBASE_AUTH_DOMAIN=...
# VITE_FIREBASE_PROJECT_ID=...
# VITE_FIREBASE_STORAGE_BUCKET=...
# VITE_FIREBASE_MESSAGING_SENDER_ID=...
# VITE_FIREBASE_APP_ID=...
npm run dev
```

### 3. Setup Backend Functions

```bash
cd ../functions
npm install
# You may need to login to firebase and select your project
# firebase login
# firebase use <your-project-id>
```

The frontend will be available at `http://localhost:5173`. 