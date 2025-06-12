import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { type WalletClient, type SignableMessage } from 'viem';
import XmtpWorker from '../workers/xmtp.worker.ts?worker';
import { saveMessageToFirestore, getMessagesFromFirestore } from '../services/firestore-messages';

// --- Ethers to Viem/Wagmi Signer Adapter ---
// XMTP SDK v3 now uses getIdentity() instead of getAddress()
// and inbox-based identity model instead of Ethereum addresses
function walletClientToSigner(walletClient: WalletClient) {
  if (!walletClient || !walletClient.account) {
    throw new Error('WalletClient or account not available');
  }
  const { account } = walletClient;

  return {
    async getAddress() {
      return account.address;
    },
    async signMessage(message: string | Uint8Array) {
      const messageToSign: SignableMessage = message instanceof Uint8Array 
        ? { raw: message } 
        : message;
      const signature = await walletClient.signMessage({ account, message: messageToSign });
      
      // Convert hex signature to Uint8Array like in xmtp.chat example
      const hex = signature.startsWith('0x') ? signature.slice(2) : signature;
      return new Uint8Array(hex.match(/.{2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
    },
  };
}

// --- Worker API Wrapper ---
// This creates a clean, promise-based interface to communicate with the Web Worker.
const xmtpWorkerApi = {
  worker: new XmtpWorker(),
  requests: new Map(),
  nextId: 0,
  walletClient: null as WalletClient | null,

  init() {
    this.worker.onmessage = (event) => {
      const { id, success, payload, error, type } = event.data;
      console.log('[Worker API] Received response:', { id, success, payload, error, type });
      
      // Handle signing requests from the worker
      if (type === 'signRequest') {
        this.handleSignRequest(id, payload);
        return;
      }
      
      // Handle Firestore save requests from the worker
      if (type === 'firestoreSave') {
        this.handleFirestoreSave(payload);
        return;
      }
      
      if (this.requests.has(id)) {
        const { resolve, reject } = this.requests.get(id);
        if (success) {
          resolve(payload);
        } else {
          reject(new Error(error.message));
        }
        this.requests.delete(id);
      }
    };
    this.worker.onerror = (error) => {
      console.error('[Worker API] Uncaught worker error:', error);
    };
    console.log('[Worker API] Worker initialized');
  },

  async handleSignRequest(id: string | number, payload: { message: string | Uint8Array }) {
    try {
      console.log('[Worker API] Handling sign request:', { id, messageType: typeof payload.message });
      
      if (!this.walletClient) {
        throw new Error('Wallet client not available for signing');
      }
      
      const signer = walletClientToSigner(this.walletClient);
      const signature = await signer.signMessage(payload.message);
      
      console.log('[Worker API] Signature received:', { signatureLength: signature.length });
      
      // Send Uint8Array signature directly to Worker
      this.worker.postMessage({
        id,
        type: 'signResponse',
        success: true,
        payload: { signature }
      });
    } catch (error: any) {
      console.error('[Worker API] Sign request failed:', error);
      this.worker.postMessage({
        id,
        type: 'signResponse',
        success: false,
        error: { message: error.message }
      });
    }
  },

  setWalletClient(walletClient: WalletClient | null) {
    this.walletClient = walletClient;
  },

  async handleFirestoreSave(payload: any) {
    try {
      console.log('[Worker API] Handling Firestore save request:', payload);
      
      // Add delay to ensure Firebase is initialized
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await saveMessageToFirestore(payload);
      console.log('[Worker API] ✅ Message saved to Firestore successfully');
    } catch (error: any) {
      console.error('[Worker API] ❌ Failed to save message to Firestore:', error);
      
      // If Firebase initialization error - not critical for core functionality
      if (error.message?.includes('Firebase app not initialized') || 
          error.message?.includes('duplicate-app')) {
        console.warn('[Worker API] ⚠️ Firebase issue detected, but XMTP still working');
      }
    }
  },

  post(action: string, payload: any) {
    const id = this.nextId++;
    console.log('[Worker API] Sending message:', { id, action, payload });
    return new Promise((resolve, reject) => {
      this.requests.set(id, { resolve, reject });
      this.worker.postMessage({ id, action, payload });
    });
  }
};
xmtpWorkerApi.init();
// --- End Worker API Wrapper ---


interface XmtpContextType {
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (to: string, message: string) => Promise<any>;
  getConversationHistory: () => Promise<any[]>;
  warmupConversation: (recipientAddress: string) => Promise<any>;
  walletAddress?: string;
}

const XmtpContext = createContext<XmtpContextType | null>(null);

export const XmtpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | undefined>();
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastFailedAddress, setLastFailedAddress] = useState<string | undefined>();
  const clientRef = useRef<any>(null);

  // Get wallet connection state from OnchainKit/Wagmi
  const { address, isConnected: isWalletConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const MAX_CONNECTION_ATTEMPTS = 2;
  const CONNECTION_COOLDOWN = 15000;

  const initXmtpClient = useCallback(async () => {
    // Check limits to prevent infinite loop
    if (!walletClient || !address || isConnecting || isConnected) return;
    
    // Check number of attempts for this address
    if (lastFailedAddress === address && connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
      console.log(`[XMTP Context] Max connection attempts (${MAX_CONNECTION_ATTEMPTS}) reached for ${address}. Skipping...`);
      return;
    }

    console.log(`[XMTP Context] Wallet connected. Initializing XMTP client... (attempt ${connectionAttempts + 1})`);
    setIsConnecting(true);

    try {
      setWalletAddress(address);
      console.log(`[XMTP Context] Initializing client for ${address} via Worker...`);

      // Set the wallet client for signing operations
      xmtpWorkerApi.setWalletClient(walletClient);

      // Instead of passing the signer object (which can't be cloned),
      // we pass only the wallet address and handle signing in the main thread
      await xmtpWorkerApi.post('initClient', { 
        walletAddress: address 
      });

      setIsConnected(true);
      clientRef.current = { address }; // Store address to indicate connection
      setConnectionAttempts(0); // Reset counter on success
      setLastFailedAddress(undefined);
      setIsConnecting(false); // Always reset isConnecting on success
      console.log('[XMTP Context] Worker-based client initialized successfully.');
      
      // Automatic warmup after client initialization to prevent first message timeout
      console.log('[XMTP Context] 🔥 Starting automatic warmup after client initialization...');
      try {
        // Small delay to ensure client is fully ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Perform a lightweight warmup operation
        await xmtpWorkerApi.post('performWarmup', {});
        console.log('[XMTP Context] ✅ Automatic warmup completed successfully');
      } catch (warmupError) {
        console.warn('[XMTP Context] ⚠️ Automatic warmup failed (non-critical):', warmupError);
        // Don't throw - warmup failure shouldn't prevent client connection
      }
    } catch (error) {
      console.error('[XMTP Context] Failed to initialize XMTP client:', error);
      setIsConnected(false);
      setWalletAddress(undefined);
      clientRef.current = null;
      
      // Increment attempt counter
      setConnectionAttempts(prev => prev + 1);
      setLastFailedAddress(address);
      
      // Always reset isConnecting on error
      setIsConnecting(false);
      
      // Add delay before next attempt only if limit not reached
      if (connectionAttempts < MAX_CONNECTION_ATTEMPTS - 1) {
        console.log(`[XMTP Context] Will retry in ${CONNECTION_COOLDOWN / 1000} seconds...`);
        setTimeout(() => {
          // Retry will happen through useEffect when conditions are right again
        }, CONNECTION_COOLDOWN);
      }
    }
  }, [walletClient, address, isConnected, connectionAttempts, lastFailedAddress, isWalletConnected]);
  
  // Effect to automatically initialize XMTP when wallet connects
  useEffect(() => {
    console.log('[XMTP Context] useEffect triggered:', {
      isWalletConnected,
      hasWalletClient: !!walletClient,
      isConnected,
      isConnecting,
      address,
      connectionAttempts,
      lastFailedAddress
    });
    
    // Reset attempt counter when address changes
    if (address && address !== lastFailedAddress) {
      setConnectionAttempts(0);
      setLastFailedAddress(undefined);
    }
    
    if (isWalletConnected && walletClient && !isConnected && !isConnecting) {
      console.log('[XMTP Context] Conditions met, calling initXmtpClient...');
      initXmtpClient();
    } else {
      console.log('[XMTP Context] Conditions not met for XMTP initialization');
    }
  }, [isWalletConnected, walletClient, isConnected, isConnecting, address]); // Removed initXmtpClient from dependency array

  const connect = useCallback(async () => {
    // Reset limits on manual connection
    setConnectionAttempts(0);
    setLastFailedAddress(undefined);
    
    // The "connect" function is now a trigger for initialization if needed,
    // but primary connection is handled by OnchainKit's UI and the useEffect.
    if (isWalletConnected && walletClient) {
      await initXmtpClient();
    } else {
      // This case should ideally not be hit if UI uses OnchainKit's Connect button.
      console.warn('[XMTP Context] `connect` called but no wallet connected via Wagmi.');
    }
  }, [isWalletConnected, walletClient, initXmtpClient]);

  const disconnect = useCallback(() => {
    // This now only disconnects the XMTP "session" state.
    // The actual wallet connection is managed by OnchainKit/Wagmi.
    clientRef.current = null;
    setIsConnected(false);
    setWalletAddress(undefined);
    setConnectionAttempts(0);
    setLastFailedAddress(undefined);
    console.log('[XMTP Context] XMTP session disconnected.');
  }, []);

  const sendMessage = useCallback(async (to: string, message: string): Promise<any> => {
    if (!isConnected) throw new Error('XMTP client not connected');
    console.log(`[XMTP Context] 🚀 Sending message to ${to} via Worker...`);
    
    try {
      const result = await xmtpWorkerApi.post('sendMessage', { recipientAddress: to, message: message });
      console.log(`[XMTP Context] ✅ Message send result:`, result);
      
      if (result && typeof result === 'object' && 'warning' in result) {
        console.warn(`[XMTP Context] ⚠️ Send completed with warning: ${(result as any).warning}`);
      }
      
      return result;
    } catch (error) {
      console.error(`[XMTP Context] ❌ Message send failed:`, error);
      throw error;
    }
  }, [isConnected]);

  const getConversationHistory = useCallback(async (): Promise<any[]> => {
    if (!isConnected || !walletAddress) {
      console.log('[XMTP Context] Not connected, returning empty history.');
      return [];
    }
    
    try {
      console.log('[XMTP Context] 📖 Getting hybrid history (XMTP + Firestore)...');
      
      // Get history from both sources in parallel
      const [xmtpHistory, firestoreHistory] = await Promise.all([
        xmtpWorkerApi.post('getHistory', {}),
        getMessagesFromFirestore(walletAddress)
      ]);
      
      console.log('[XMTP Context] 📊 History sources:', {
        xmtpMessages: Array.isArray(xmtpHistory) ? xmtpHistory.length : 0,
        firestoreMessages: firestoreHistory.length
      });
      
      // Combine and deduplicate messages
      const allMessages = new Map();
      
      // Add messages from XMTP
      if (Array.isArray(xmtpHistory)) {
        xmtpHistory.forEach((msg: any) => {
          const key = `${msg.senderInboxId || msg.from}-${msg.sentAtNs || msg.timestamp}-${msg.content}`;
          allMessages.set(key, { ...msg, source: 'xmtp' });
        });
      }
      
      // Add messages from Firestore (if not duplicates)
      firestoreHistory.forEach((msg) => {
        const key = `${msg.senderInboxId || msg.from}-${msg.sentAtNs || msg.timestamp.getTime()}-${msg.content}`;
        if (!allMessages.has(key)) {
          allMessages.set(key, { 
            ...msg, 
            source: 'firestore',
            sentAtNs: msg.sentAtNs || msg.timestamp.getTime().toString()
          });
        }
      });
      
      // Sort by time
      const combinedHistory = Array.from(allMessages.values()).sort((a, b) => {
        const timeA = parseInt(a.sentAtNs || '0') || new Date(a.timestamp || 0).getTime();
        const timeB = parseInt(b.sentAtNs || '0') || new Date(b.timestamp || 0).getTime();
        return timeB - timeA; // Newest messages on top
      });
      
      console.log('[XMTP Context] ✅ Combined history:', combinedHistory.length, 'messages');
      return combinedHistory;
      
    } catch (error) {
      console.error('[XMTP Context] ❌ Failed to get conversation history:', error);
      // Fallback to XMTP history only
      try {
        const xmtpHistory = await xmtpWorkerApi.post('getHistory', {});
        return (xmtpHistory as any[]) || [];
      } catch (fallbackError) {
        console.error('[XMTP Context] ❌ Fallback also failed:', fallbackError);
        return [];
      }
    }
  }, [isConnected, walletAddress]);

  const warmupConversation = useCallback(async (recipientAddress: string): Promise<any> => {
    if (!isConnected) throw new Error('XMTP client not connected');
    console.log(`[XMTP Context] 🔥 Starting conversation warmup for ${recipientAddress}...`);
    
    try {
      const result = await xmtpWorkerApi.post('warmupConversation', { recipientAddress });
      console.log(`[XMTP Context] ✅ Warmup result:`, result);
      return result;
    } catch (error) {
      console.error(`[XMTP Context] ❌ Warmup failed:`, error);
      throw error;
    }
  }, [isConnected]);
  

  const value: XmtpContextType = {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    sendMessage,
    getConversationHistory,
    warmupConversation,
    walletAddress,
  };

  return <XmtpContext.Provider value={value}>{children}</XmtpContext.Provider>;
};

export const useXmtp = () => {
  const context = useContext(XmtpContext);
  if (!context) {
    throw new Error('useXmtp must be used within XmtpProvider');
  }
  return context;
}; 