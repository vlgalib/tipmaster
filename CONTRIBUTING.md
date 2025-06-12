# Contributing to TipMaster 🤝

Thank you for your interest in contributing to TipMaster! This guide focuses on **Coinbase OnchainKit**, **XMTP Protocol**, and **browser-first** development practices.

## 🚀 Getting Started with Coinbase Stack

### Prerequisites
- **Coinbase Wallet** - Primary development wallet
- **Base Network Access** - Testnet and Mainnet
- **OnchainKit Knowledge** - Familiarity with Coinbase's Web3 components
- **XMTP Understanding** - Decentralized messaging concepts
- **Browser Development** - Modern web APIs and PWA concepts

### Development Environment

1. **Coinbase Wallet Setup**
```bash
# Install Coinbase Wallet browser extension
# Connect to Base network
# Get testnet ETH and USDC from Base faucet
```

2. **OnchainKit Development**
```bash
git clone https://github.com/vlgalib/tipmaster.git
cd tipmaster/frontend
npm install
# OnchainKit components are pre-configured
```

3. **XMTP Browser Testing**
```bash
# Use /xmtp-debug page for testing
# Test with multiple Coinbase Wallet accounts
# Verify message delivery across browsers
```

## 🏗️ Coinbase Technology Focus Areas

### OnchainKit Components
We heavily utilize Coinbase's OnchainKit for Web3 interactions:

#### Wallet Integration
```typescript
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownLink,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet';

// Preferred: Use OnchainKit components over custom wallet logic
<Wallet>
  <ConnectWallet />
  <WalletDropdown>
    <WalletDropdownLink icon="wallet" href="/profile">
      Profile
    </WalletDropdownLink>
    <WalletDropdownDisconnect />
  </WalletDropdown>
</Wallet>
```

#### Transaction Components
```typescript
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
} from '@coinbase/onchainkit/transaction';

// Preferred: Use OnchainKit for all transactions
<Transaction
  contracts={tipContracts}
  onSuccess={handleTipSuccess}
  onError={handleTipError}
>
  <TransactionButton text="Send Tip" />
  <TransactionStatus>
    <TransactionStatusLabel />
    <TransactionStatusAction />
  </TransactionStatus>
</Transaction>
```

#### Identity & ENS
```typescript
import {
  Identity,
  Name,
  Avatar,
  Address,
} from '@coinbase/onchainkit/identity';

// Preferred: Use OnchainKit for identity display
<Identity address={userAddress} schemaId="0x...">
  <Avatar />
  <Name />
  <Address />
</Identity>
```

### XMTP Browser SDK Integration

#### Web Worker Architecture
```typescript
// workers/xmtp.worker.ts
import { Client } from '@xmtp/browser-sdk';

class RemoteSigner {
  async signMessage(message: string) {
    // Delegate to main thread for Coinbase Wallet signing
    return new Promise((resolve, reject) => {
      const id = Date.now();
      self.postMessage({
        type: 'signRequest',
        id,
        message: typeof message === 'string' ? message : new TextDecoder().decode(message)
      });
      
      // Handle response from main thread
      this.pendingSignatures.set(id, { resolve, reject });
    });
  }
}
```

#### Browser Optimization Patterns
```typescript
// Preferred: Use conversation caching
const xmtpConversationCache = new Map();

// Preferred: Implement smart retry with exponential backoff
const sendWithRetry = async (message, maxAttempts = 3) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await conversation.send(message);
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => 
        setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 8000))
      );
    }
  }
};
```

### Base Network Optimizations

#### Network Configuration
```typescript
import { base } from 'wagmi/chains';

// Preferred: Use Base-specific optimizations
const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(), // OnchainKit handles RPC optimization
  },
});
```

#### USDC Integration
```typescript
// Preferred: Use Base native USDC
const USDC_BASE_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Preferred: Use OnchainKit for USDC transactions
const usdcTransfer = {
  to: USDC_BASE_ADDRESS,
  data: encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipientAddress, parseUnits(amount, 6)],
  }),
};
```

## 📝 Development Guidelines

### Code Style for Coinbase Stack

#### OnchainKit Best Practices
- **Always use OnchainKit components** instead of custom wallet logic
- **Leverage OnchainKit theming** for consistent UI
- **Use OnchainKit hooks** for wallet state management
- **Follow OnchainKit patterns** for error handling

#### XMTP Browser Patterns
- **Use Web Workers** for XMTP client operations
- **Implement conversation caching** to reduce API calls
- **Use structured message formats** for tip notifications
- **Handle browser compatibility** gracefully

#### Browser-First Development
- **Optimize for mobile browsers** (primary use case)
- **Use PWA features** for app-like experience
- **Implement offline support** where possible
- **Use modern Web APIs** (Web Workers, Service Workers, etc.)

### Git Workflow for Coinbase Features

```bash
# Feature branches should indicate the technology
git checkout -b feature/onchainkit-identity-integration
git checkout -b feature/xmtp-browser-optimization
git checkout -b feature/base-network-enhancement
```

### Commit Message Conventions
```
feat(onchainkit): add transaction status component
fix(xmtp): resolve browser worker message handling
perf(base): optimize USDC transfer gas usage
docs(coinbase): update OnchainKit integration guide
```

## 🧪 Testing with Coinbase Stack

### OnchainKit Testing
```typescript
// Test OnchainKit components in isolation
import { render } from '@testing-library/react';
import { OnchainKitProvider } from '@coinbase/onchainkit';

const renderWithOnchainKit = (component) => {
  return render(
    <OnchainKitProvider chain={base}>
      {component}
    </OnchainKitProvider>
  );
};
```

### XMTP Browser Testing
- **Use multiple browser tabs** to test messaging
- **Test with different Coinbase Wallet accounts**
- **Verify Web Worker performance** under load
- **Test offline/online scenarios**

### Base Network Testing
- **Test on Base Sepolia** before mainnet
- **Verify gas optimization** for USDC transfers
- **Test transaction status** with OnchainKit components

## 🔧 Technical Contribution Areas

### High Priority: OnchainKit Enhancements
- **New OnchainKit component integrations**
- **Custom OnchainKit theme development**
- **OnchainKit performance optimizations**
- **Advanced transaction patterns**

### High Priority: XMTP Browser Features
- **Web Worker performance improvements**
- **Browser compatibility enhancements**
- **Message delivery optimization**
- **Offline message queuing**

### Medium Priority: Base Network Features
- **Gas optimization strategies**
- **Base-specific contract integrations**
- **BaseScan integration enhancements**
- **Base ecosystem tool integrations**

### Browser & PWA Improvements
- **Service Worker optimizations**
- **Mobile browser UX enhancements**
- **Offline functionality**
- **Performance monitoring**

## 🐛 Bug Reports for Coinbase Stack

When reporting bugs, specify the technology:

### OnchainKit Issues
- **Component**: Which OnchainKit component
- **Version**: OnchainKit version number
- **Browser**: Browser and version
- **Wallet**: Coinbase Wallet version
- **Network**: Base network (mainnet/testnet)

### XMTP Browser Issues
- **Worker**: Web Worker vs main thread
- **Browser**: Browser compatibility
- **Performance**: Message delivery timing
- **Caching**: Conversation cache behavior

### Base Network Issues
- **Transaction**: Gas usage and timing
- **RPC**: Network connectivity
- **Contract**: Smart contract interactions

## 💡 Feature Requests

### OnchainKit Feature Ideas
- **New component integrations** from OnchainKit roadmap
- **Custom styling patterns** for TipMaster branding
- **Advanced transaction flows** (batch, sponsored, etc.)
- **Identity enhancements** (Basename integration)

### XMTP Browser Enhancements
- **Message types** (rich media, reactions, etc.)
- **Performance optimizations** for mobile browsers
- **Offline capabilities** with service workers
- **Group messaging** features

### Base Network Integrations
- **DeFi integrations** on Base
- **NFT features** for staff profiles
- **Cross-chain** functionality
- **Base ecosystem** tool integrations

## 🔒 Security for Coinbase Stack

### OnchainKit Security
- **Never bypass OnchainKit** security patterns
- **Use OnchainKit validation** for all transactions
- **Follow OnchainKit** best practices for wallet integration

### XMTP Security
- **Validate message signatures** in Web Workers
- **Use XMTP encryption** properly
- **Handle key management** securely

### Base Network Security
- **Validate contract addresses** on Base
- **Use proper gas limits** to prevent failures
- **Implement transaction monitoring**

## 📚 Documentation Standards

### OnchainKit Documentation
- **Component usage examples** with real TipMaster code
- **Integration patterns** specific to our use cases
- **Performance considerations** for browser deployment

### XMTP Documentation
- **Web Worker patterns** and best practices
- **Browser compatibility** notes and workarounds
- **Message format specifications** for tip notifications

### Base Network Documentation
- **Contract interaction** patterns
- **Gas optimization** strategies
- **Network configuration** for different environments

## 🌟 Recognition

Contributors focusing on Coinbase stack improvements will be:
- **Featured** in OnchainKit showcase submissions
- **Highlighted** in Base ecosystem developer spotlights
- **Invited** to Coinbase developer community events

## 📞 Getting Help

### Coinbase Resources
- **OnchainKit Discord**: Official OnchainKit community
- **Base Discord**: Base network developer community
- **Coinbase Developer Docs**: Official documentation

### XMTP Resources
- **XMTP Discord**: XMTP protocol community
- **XMTP Docs**: Browser SDK documentation
- **XMTP GitHub**: Issues and discussions

### TipMaster Specific
- **GitHub Issues**: Tag with `onchainkit`, `xmtp`, or `base`
- **Discussions**: Architecture and integration questions

---

Built with ❤️ for the **Coinbase ecosystem** using **OnchainKit**, **XMTP**, and **Base** 