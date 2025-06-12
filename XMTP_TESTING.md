# XMTP Testing and Debugging

## Dev Server Issue

In dev mode, Vite has issues with polyfills for XMTP SDK:
```TypeError: globalThis is undefined
```

## Testing Solutions

### 1. Production Build (Recommended)
```bash
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```
Test at: https://tips-6545c.web.app/xmtp-debug

### 2. Preview Mode
```bash
cd frontend
npm run build
npm run preview
```
Test at: http://localhost:4173/xmtp-debug

### 3. Dev Mode (may work with workarounds)
```bash
cd frontend
npm run dev
```
- Open: http://localhost:5174/xmtp-debug
- In Dev Tools Console execute:
```javascript
window.globalThis = window;
window.global = window;
```
- Then reload the page

## What to Test

### ✅ Successful Scenario
1. Connect Wallet - should connect MetaMask
2. Connect XMTP - should show "Connected" 
3. Enter test address (your own or another XMTP address)
4. Check canMessage - should return true/false
5. Send Message - should send message
6. Get Conversations - should show list of conversations
7. Get History - should show message history

### ❌ Possible Errors
- `globalThis is undefined` - polyfill issue (dev mode)
- `Wallet not connected` - need to connect wallet first
- `XMTP client not connected` - need to connect XMTP after wallet
- `Cannot message address` - address not registered in XMTP
- `Connection timeout` - network issues or XMTP service problems

## Logs to Monitor

### Successful Connection
```
[XMTP Debug] SUCCESS: Wallet connected successfully: 0x...
[XMTP Debug] SUCCESS: XMTP connected successfully
[XMTP] Successfully imported XMTP module
[XMTP] Building XMTP client...
[XMTP] Client connected successfully with V3 API
```

### Connection Error
```
[XMTP Debug] ERROR: Failed to connect to XMTP
[XMTP] Connection error: TypeError: globalThis is undefined
```

## V3 API Methods Being Tested

```typescript
// Initialization
const client = await Client.build({ signer });

// Check messaging capability
const canSend = await client.canMessage(address);

// Create conversation
const conversation = await client.conversations.findOrCreateDm({ 
  peerAddress: address 
});

// Send message
await conversation.send(message);

// List conversations
const conversations = await client.conversations.list();

// Message history
const messages = await conversation.list();
```

## Useful Commands

### Clear Cache
```bash
rm -rf node_modules/.vite
npm run dev
```

### Check Versions
```bash
npm ls @xmtp/browser-sdk
npm ls vite
```

### Build with Debug
```bash
npm run build 2>&1 | tee build.log
``` 