# XMTP Debug Console - Usage Guide

## Access to Debug Page

1. **Locally**: http://localhost:5173/xmtp-debug
2. **Production**: https://tips-6545c.web.app/xmtp-debug

## Functionality

### 🔗 Connection
- **Connect Wallet**: Connects MetaMask or other Ethereum wallet
- **Connect XMTP**: Initializes XMTP client with V3 API

### 🧪 Testing
- **Test Address**: Enter Ethereum address for testing
- **Test Message**: Enter message to send
- **Check canMessage**: Checks if message can be sent to address
- **Send Message**: Sends test message
- **Send Test Tip**: Sends structured tip notification

### 📊 Monitoring
- **Get Conversations**: Gets list of all conversations from XMTP
- **Get History**: Gets message history
- **Debug Logs**: Displays real-time logs with timestamps
- **Data Display**: Shows received data in JSON format

## V3 API Methods

The page tests the following XMTP V3 methods:

```typescript
// Client initialization
const client = await Client.build({ signer });

// Create/find conversation
const conversation = await client.conversations.findOrCreateDm({ 
  peerAddress: address 
});

// Send message
await conversation.send(message);

// Get conversations
const conversations = await client.conversations.list();

// Get messages
const messages = await conversation.list();
```

## Log Color Scheme

- 🔵 **INFO** (blue): Informational messages
- 🟢 **SUCCESS** (green): Successful operations
- 🟡 **WARN** (yellow): Warnings
- 🔴 **ERROR** (red): Errors

## Message Types for Testing

### Simple Text Message
```
Hello from XMTP Debug!
```

### Structured Tip Notification
```json
{
  "type": "tip-v1",
  "amount": 5.0,
  "currency": "USDC",
  "txHash": "0x1234567890abcdef...",
  "timestamp": "2025-01-12T10:00:00.000Z",
  "message": "Test tip from debug page",
  "sender": "0x...",
  "recipient": "0x...",
  "network": "base-mainnet"
}
```

## Troubleshooting

### Wallet Won't Connect
1. Make sure MetaMask is installed
2. Allow connection to the site
3. Switch to Base network (Chain ID: 8453)

### XMTP Won't Connect
1. Connect wallet first
2. Make sure you have ETH for message signing
3. Check logs for errors
4. Try clearing logs and reconnecting

### Can't Send Message
1. Check recipient address is correct
2. Make sure recipient is registered in XMTP (use canMessage)
3. Check internet connection

## Useful Addresses for Testing

You can use the following addresses (if they are registered in XMTP):
- Your own address (for self-testing)
- Addresses from Base network with XMTP activity

## Integration with Main Application

The debug console uses the same XMTP context as the main application:
- `XmtpContext` - centralized state management
- Same API methods used in TipPage and SendTipPage
- Same error handling and logging

## Next Steps

After successful testing:
1. Check functionality on main application pages
2. Test sending real tips
3. Make sure notifications are delivered correctly 