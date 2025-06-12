# TipMaster 🪙

A modern cryptocurrency tipping platform built with **Coinbase OnchainKit**, **XMTP Protocol**, and **Base network**. TipMaster demonstrates the power of Coinbase's Web3 infrastructure for seamless browser-based crypto applications.

🌐 **Live Demo**: [https://tipmaster.xyz](https://tipmaster.xyz)

## 🌟 Key Features

- **🔐 Coinbase Wallet Integration**: Native support for Coinbase Wallet with OnchainKit components
- **👤 Staff Profiles**: Create profiles with custom avatars and QR codes for easy tipping
- **📱 QR Code Tipping**: Customers scan QR codes to instantly send tips
- **💰 Base Network Native**: Built specifically for Base - Coinbase's Ethereum L2
- **💬 XMTP Messaging**: Real-time tip notifications using XMTP's decentralized protocol
- **📊 OnchainKit Analytics**: Transaction tracking with Coinbase's UI components
- **🌐 Browser-First PWA**: Optimized for mobile browsers with installable experience
- **🔒 Non-custodial**: Users maintain full control via Coinbase Wallet integration

## 🏗️ Coinbase Technology Stack

### OnchainKit Integration
- **`@coinbase/onchainkit`** - Core Web3 UI components and wallet connection
- **Wallet Component** - Seamless Coinbase Wallet integration
- **Transaction Components** - Native Base network transaction handling
- **Identity Components** - ENS and Basename resolution
- **Fund Component** - Easy onramp integration for USDC

### Base Network Optimization
- **Base Mainnet** - Coinbase's Ethereum L2 for fast, cheap transactions
- **Native USDC** - Direct integration with Base's native USDC token
- **Base RPC** - Optimized RPC endpoints via OnchainKit
- **BaseScan Integration** - Transaction explorer links and verification

### XMTP Browser SDK
- **`@xmtp/browser-sdk`** - Decentralized messaging in the browser
- **Web Worker Architecture** - Background message processing for performance
- **RemoteSigner Pattern** - Secure wallet integration with XMTP client
- **Conversation Caching** - Optimized message delivery and storage

### Browser-First Architecture
- **React 19** - Latest React with concurrent features for smooth UX
- **Vite** - Fast build tool optimized for modern browsers
- **Web Workers** - Background XMTP processing without blocking UI
- **PWA Support** - Installable app experience with service workers

## 🔄 Application Flow

### 1. Coinbase Wallet Connection
```
User opens app → OnchainKit Wallet component → Coinbase Wallet connects → Base network auto-selected
```

### 2. Staff Registration with OnchainKit
```
Connect wallet → OnchainKit Identity → Create profile → Upload to Firebase → Generate QR code
```

### 3. Customer Tipping Flow
```
Scan QR → OnchainKit Transaction → USDC transfer on Base → XMTP notification → Dashboard update
```

### 4. XMTP Message Architecture
```
Transaction success → XMTP Browser SDK → Web Worker processing → Firestore backup → Real-time UI update
```

## 🛠️ Technical Implementation

### OnchainKit Components Used
```typescript
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownLink,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet';

import {
  Transaction,
  TransactionButton,
  TransactionSponsor,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
} from '@coinbase/onchainkit/transaction';

import { OnchainKitProvider } from '@coinbase/onchainkit';
```

### XMTP Browser Integration
```typescript
import { Client } from '@xmtp/browser-sdk';

// Web Worker with RemoteSigner for secure wallet integration
class RemoteSigner {
  async signMessage(message: string) {
    // Delegates to main thread for Coinbase Wallet signing
    return await this.requestSignature(message);
  }
}

// Optimized for browser environment
const client = await Client.create(signer, {
  env: 'production',
  apiUrl: 'https://production.xmtp.network'
});
```

### Base Network Configuration
```typescript
import { base } from 'wagmi/chains';

const config = {
  chains: [base],
  transports: {
    [base.id]: http(), // OnchainKit handles RPC optimization
  },
};
```

### Browser Optimizations
- **Code Splitting**: Dynamic imports for OnchainKit components
- **Web Worker XMTP**: Background message processing
- **Service Worker**: PWA caching and offline support
- **IndexedDB Fallback**: Hybrid storage for Firebase compatibility

## 📁 Project Structure

```
TipMaster/
├── frontend/src/
│   ├── components/
│   │   ├── OnchainKit/     # OnchainKit component wrappers
│   │   └── XMTP/          # XMTP messaging components
│   ├── contexts/
│   │   ├── OnchainContext.tsx  # OnchainKit provider setup
│   │   └── XmtpContext.tsx     # XMTP client management
│   ├── workers/
│   │   └── xmtp.worker.ts      # XMTP Browser SDK worker
│   ├── services/
│   │   ├── onchain.ts          # OnchainKit utilities
│   │   └── xmtp.ts            # XMTP service layer
│   └── hooks/
│       ├── useOnchainKit.ts    # OnchainKit custom hooks
│       └── useXmtp.ts         # XMTP messaging hooks
├── functions/               # Firebase Cloud Functions
└── docs/                   # Coinbase integration guides
```

## 🚀 Getting Started

### Prerequisites
- **Coinbase Wallet** - Primary wallet for testing
- **Base Network** - Ensure wallet is connected to Base
- **Node.js 18+** - For development environment
- **Firebase CLI** - For backend deployment

### Quick Start with Coinbase Integration

1. **Clone and Install**
```bash
git clone https://github.com/vlgalib/tipmaster.git
cd tipmaster
cd frontend && npm install
cd ../functions && npm install
```

2. **Environment Setup**
```bash
cp env.example frontend/.env.local
```

Configure with your Firebase settings:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

3. **Development with OnchainKit**
```bash
cd frontend
npm run dev
# Open http://localhost:5173
# Connect Coinbase Wallet
# Switch to Base network
# Start testing!
```

## 🔧 Coinbase Integration Details

### OnchainKit Provider Setup
```typescript
<OnchainKitProvider
  apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
  chain={base}
  config={{
    appearance: {
      mode: 'auto',
      theme: 'default',
    },
  }}
>
  <App />
</OnchainKitProvider>
```

### Transaction Flow with OnchainKit
```typescript
const handleTip = useCallback(() => {
  return [
    {
      to: recipientAddress,
      value: parseEther(tipAmount),
      data: '0x', // Simple USDC transfer
    },
  ];
}, [recipientAddress, tipAmount]);

<Transaction
  contracts={handleTip}
  onSuccess={handleTransactionSuccess}
  onError={handleTransactionError}
>
  <TransactionButton />
  <TransactionStatus>
    <TransactionStatusLabel />
    <TransactionStatusAction />
  </TransactionStatus>
</Transaction>
```

### XMTP Browser SDK Integration
```typescript
// Worker-based XMTP for performance
const xmtpWorker = new Worker('/xmtp.worker.js');

// Initialize with Coinbase Wallet signer
await xmtpWorker.postMessage({
  action: 'initClient',
  payload: { walletAddress: address }
});

// Send tip notification
await xmtpWorker.postMessage({
  action: 'sendMessage',
  payload: {
    recipientAddress,
    message: JSON.stringify({
      type: 'tip-v1',
      amount: tipAmount,
      currency: 'USDC',
      txHash: transactionHash,
      network: 'base-mainnet'
    })
  }
});
```

## 📊 Browser Performance Optimizations

### OnchainKit Optimizations
- **Tree Shaking**: Import only needed OnchainKit components
- **Code Splitting**: Lazy load transaction components
- **Caching**: Leverage OnchainKit's built-in caching

### XMTP Browser Optimizations
- **Web Workers**: Keep UI thread free during message processing
- **Conversation Caching**: Reduce API calls for repeat conversations
- **Hybrid Storage**: XMTP + Firestore for reliability

### PWA Features
- **Service Worker**: Cache OnchainKit assets and XMTP data
- **Offline Support**: Queue transactions for when connection returns
- **Install Prompt**: Native app-like experience

## 🔐 Security with Coinbase Infrastructure

### Wallet Security
- **Non-custodial**: Private keys stay in Coinbase Wallet
- **Secure Signing**: OnchainKit handles signature requests safely
- **Network Validation**: Automatic Base network verification

### XMTP Security
- **End-to-End Encryption**: XMTP protocol handles message encryption
- **Identity Verification**: Wallet-based identity for message authenticity
- **Decentralized**: No central message storage or control

## 🌐 Deployment

### Firebase Hosting (Recommended)
```bash
npm run build
firebase deploy --only hosting
```

### Coinbase-Optimized Configuration
- **Base RPC**: Automatic via OnchainKit
- **CORS Headers**: Configured for XMTP and OnchainKit APIs
- **PWA Manifest**: Optimized for Coinbase Wallet integration

## 🤝 Contributing

We welcome contributions that enhance Coinbase technology integration:

- **OnchainKit Components**: New UI components and patterns
- **XMTP Features**: Enhanced messaging capabilities
- **Base Network**: Optimizations for Base-specific features
- **Browser Performance**: PWA and Web Worker improvements

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support & Resources

- **OnchainKit Docs**: https://onchainkit.xyz
- **XMTP Docs**: https://xmtp.org/docs
- **Base Network**: https://base.org
- **Coinbase Wallet**: https://wallet.coinbase.com

---

Built with ❤️ using **Coinbase OnchainKit**, **XMTP Protocol**, and **Base Network** 