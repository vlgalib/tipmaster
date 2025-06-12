interface XmtpTip {
  amount: number;
  currency?: string;
  txHash: string;
  timestamp: string | Date;
  message?: string;
  sender: string;
  recipient: string;
}

interface XmtpMessage {
  content: string;
  senderAddress: string;
  sent: Date;
  id: string;
}

interface XmtpConversation {
  peerAddress: string;
  messages: XmtpMessage[];
}

// XMTP client cache
let xmtpClient: any = null;

export async function initializeXmtpClient(signer: any): Promise<any> {
  if (xmtpClient) {
    return xmtpClient;
  }
  
  console.log('[XMTP Browser] Initializing XMTP client...');
  
  try {
    const { Client } = await import('@xmtp/browser-sdk');
    // Use V3 API Client.build
    xmtpClient = await (Client as any).build({ signer });
    console.log('[XMTP Browser] Client created successfully with V3 API');
    return xmtpClient;
  } catch (error) {
    console.error('[XMTP Browser] Failed to create client:', error);
    throw error;
  }
}

export async function getXmtpHistory(walletAddress: string, signer: any): Promise<XmtpTip[]> {
  try {
    console.log('[XMTP Browser] Fetching history directly from XMTP network...');
    
    // Initialize client
    const client = await initializeXmtpClient(signer);
    
    // Get all conversations using V3 API
    console.log('[XMTP Browser] Getting conversations from network...');
    const allConversations = await client.conversations.list();
    console.log(`[XMTP Browser] Found ${allConversations.length} total conversations`);
    
    // Process all conversations for tip messages
    const allTips: XmtpTip[] = [];
    
    for (const conversation of allConversations) {
      try {
        // Get all messages from this conversation using V3 API
        const messages = await conversation.list();
        
        // Parse messages for tips
        for (const message of messages) {
          try {
            let content = message.content;
            
            // Try to parse as JSON (structured tip)
            if (typeof content === 'string' && content.startsWith('{')) {
              try {
                const parsed = JSON.parse(content);
                if (parsed.type === 'tip-v1') {
                  allTips.push({
                    amount: parsed.amount || 0,
                    currency: parsed.currency || 'USDC',
                    txHash: parsed.txHash || '',
                    timestamp: parsed.timestamp || message.sent || new Date().toISOString(),
                    message: parsed.message || 'Tip received',
                    sender: message.senderAddress || conversation.peerAddress || 'unknown',
                    recipient: walletAddress
                  });
                  continue;
                }
              } catch (parseError) {
                // Not valid JSON, continue with text parsing
              }
            }
            
            // Parse as text for legacy tips
            if (typeof content === 'string' && content.includes('tip')) {
              const tipMatch = content.match(/(\d+(?:\.\d+)?)\s*(USDC|USD)/i);
              const txMatch = content.match(/https:\/\/.*\/tx\/([a-fA-F0-9]+)/);
              
              if (tipMatch) {
                allTips.push({
                  amount: parseFloat(tipMatch[1]),
                  currency: tipMatch[2].toUpperCase(),
                  txHash: txMatch ? txMatch[1] : '',
                  timestamp: message.sent || new Date().toISOString(),
                  message: content,
                  sender: message.senderAddress || conversation.peerAddress || 'unknown',
                  recipient: walletAddress
                });
              }
            }
          } catch (msgError) {
            console.error('[XMTP Browser] Error parsing message:', msgError);
          }
        }
      } catch (convError) {
        console.error('[XMTP Browser] Error processing conversation:', convError);
      }
    }
    
    // Sort by timestamp (newest first)
    allTips.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    console.log(`[XMTP Browser] Found ${allTips.length} tip messages`);
    return allTips;
    
  } catch (error) {
    console.error('[XMTP Browser] Error fetching XMTP history:', error);
    return [];
  }
}

export async function sendTipNotification(
  signer: any,
  recipientAddress: string,
  amount: number,
  txHash: string,
  customMessage?: string
): Promise<void> {
  try {
    console.log(`[XMTP Browser] Sending tip notification to ${recipientAddress}...`);
    
    // Initialize client
    const client = await initializeXmtpClient(signer);
    
    // Use V3 API findOrCreateDm method
    const conversation = await client.conversations.findOrCreateDm({ 
      peerAddress: recipientAddress 
    });
    
    if (!conversation) {
      throw new Error(`Cannot create conversation with ${recipientAddress}`);
    }
    
    // Create structured notification
    const tipNotification = {
      type: "tip-v1",
      amount: amount,
      currency: "USDC",
      txHash: txHash,
      timestamp: new Date().toISOString(),
      message: customMessage || `You received ${amount} USDC tip!`,
      sender: await signer.getAddress(),
      recipient: recipientAddress,
      network: "base-mainnet"
    };
    
    // Send notification
    await conversation.send(JSON.stringify(tipNotification));
    
    console.log(`[XMTP Browser] Tip notification sent successfully to ${recipientAddress}`);
  } catch (error) {
    console.error('[XMTP Browser] Failed to send tip notification:', error);
    throw error;
  }
}

// Clear client cache (when switching wallets)
export function clearXmtpClient(): void {
  xmtpClient = null;
  console.log('[XMTP Browser] Client cache cleared');
}

export type { XmtpTip, XmtpMessage, XmtpConversation }; 