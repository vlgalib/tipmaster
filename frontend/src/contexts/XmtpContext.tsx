import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { type WalletClient } from 'viem';
import XmtpWorker from '../workers/xmtp.worker.ts?worker';
import { saveMessageToFirestore, getMessagesFromFirestore } from '../services/firestore-messages';

// --- Wagmi to XMTP v3 Signer Adapter ---
// XMTP Browser SDK v3 requires specific signer interface with getIdentity()
function walletClientToXmtpSigner(walletClient: WalletClient, isSmartWallet: boolean = false): any {
  if (!walletClient || !walletClient.account) {
    throw new Error('WalletClient or account not available');
  }
  const { account } = walletClient;

  // Determine wallet type based on detection
  const walletType = isSmartWallet ? 'SCW' : 'EOA';
  
  console.log('[Wagmi Signer] 🔧 Creating XMTP signer:', {
    walletType,
    address: account.address,
    isSmartWallet
  });

  // Create signer according to official XMTP documentation
  const signer = {
    type: walletType as 'EOA' | 'SCW',
    
    // Required: getIdentifier method (XMTP v3 standard)
    getIdentifier() {
      return {
        identifier: account.address.toLowerCase(),
        identifierKind: 'Ethereum' as const
      };
    },
    
    // Required: signMessage method returning Uint8Array
    async signMessage(message: string | Uint8Array): Promise<Uint8Array> {
      console.log('[Wagmi Signer] 🔄 Signing message...', { 
        messageType: typeof message,
        messageLength: message.length,
        isUint8Array: message instanceof Uint8Array,
        isString: typeof message === 'string',
        walletType
      });

      try {
        // Convert message to string format for wallet signing
        let messageToSign: string;
        if (message instanceof Uint8Array) {
          // For Uint8Array, convert to hex string
          messageToSign = `0x${Array.from(message).map(b => b.toString(16).padStart(2, '0')).join('')}`;
        } else {
          messageToSign = message;
        }

        console.log('[Wagmi Signer] 📝 Message prepared for signing:', { 
          originalLength: message.length,
          preparedMessage: messageToSign.slice(0, 100) + '...',
          messageFormat: messageToSign.startsWith('0x') ? 'hex' : 'string'
        });

        // Sign message using wallet client
        const signature = await walletClient.signMessage({
          account: account,
          message: messageToSign
        });

        console.log('[Wagmi Signer] ✅ Raw signature received:', { 
          signature: signature.slice(0, 20) + '...',
          signatureLength: signature.length,
          signatureFormat: signature.startsWith('0x') ? 'hex' : 'unknown',
          walletType
        });

        // Handle different signature formats
        let extractedHex = signature.replace(/^0x/, '');
        
        console.log('[Wagmi Signer] 🔍 Processing signature...', { 
          originalLength: extractedHex.length,
          expectedLength: 130, // 65 bytes * 2 hex chars
          needsExtraction: extractedHex.length > 130,
          walletType
        });

        // Enhanced extraction for Smart Wallets with multiple strategies
        if (extractedHex.length > 130) {
          console.log('[Wagmi Signer] 🔄 Applying enhanced signature extraction strategies for', walletType);
          
          // Strategy 1: Extract last 130 characters (standard approach)
          let strategy1 = extractedHex.slice(-130);
          console.log('[Wagmi Signer] 📋 Strategy 1 - Last 130 chars:', { 
            extracted: strategy1.slice(0, 20) + '...',
            extractedLength: strategy1.length 
          });

          // Strategy 2: Look for signature patterns
          const signaturePattern = /([0-9a-fA-F]{128}[0-9a-fA-F]{2})$/;
          const match = extractedHex.match(signaturePattern);
          let strategy2 = match ? match[1] : null;
          
          if (strategy2) {
            console.log('[Wagmi Signer] 📋 Strategy 2 - Pattern match:', { 
              extracted: strategy2.slice(0, 20) + '...',
              extractedLength: strategy2.length 
            });
          }

          // Strategy 3: Enhanced ERC-1271 parsing for Smart Contract Wallets
          if (isSmartWallet && extractedHex.length > 260) {
            console.log('[Wagmi Signer] 🔍 Applying ERC-1271 parsing strategies for Smart Contract Wallet...');
            
            // Multiple extraction strategies for Smart Wallet signatures
            const strategies = [
              // Strategy 3a: Remove ERC-1271 magic values and extract
              extractedHex.replace(/^(20c13b0b|1626ba7e)/i, '').slice(-130),
              // Strategy 3b: Skip RLP length prefixes
              extractedHex.slice(8, 138),
              // Strategy 3c: Extract from middle section
              extractedHex.slice(Math.floor((extractedHex.length - 130) / 2), Math.floor((extractedHex.length - 130) / 2) + 130),
              // Strategy 3d: Skip potential contract address (40 chars) and extract
              extractedHex.slice(40, 170),
              // Strategy 3e: Extract from position 64 chars from end
              extractedHex.slice(-194, -64)
            ];
            
            // Test each strategy for valid signature format
            for (let i = 0; i < strategies.length; i++) {
              const candidate = strategies[i];
              if (candidate && candidate.length === 130) {
                // Basic validation: check if r and s are not zero, v is valid
                const r = candidate.slice(0, 64);
                const s = candidate.slice(64, 128);
                const v = candidate.slice(128, 130);
                
                const isValidR = r !== '0'.repeat(64);
                const isValidS = s !== '0'.repeat(64);
                const isValidV = ['1b', '1c', '00', '01', '27', '28'].includes(v);
                
                if (isValidR && isValidS && isValidV) {
                  console.log(`[Wagmi Signer] ✅ ERC-1271 Strategy 3${String.fromCharCode(97 + i)} successful:`, { 
                    strategy: i + 1,
                    r: r.slice(0, 10) + '...',
                    s: s.slice(0, 10) + '...',
                    v: v,
                    isValid: true
                  });
                  extractedHex = candidate;
                  break;
                }
              }
            }
          }

          // Use the best available strategy
          if (strategy2 && strategy2.length === 130) {
            extractedHex = strategy2;
            console.log('[Wagmi Signer] 🎯 Using Strategy 2 (pattern match)');
          } else if (strategy1.length === 130) {
            extractedHex = strategy1;
            console.log('[Wagmi Signer] 🎯 Using Strategy 1 (last 130 chars)');
          }

          console.log('[Wagmi Signer] 🔄 Extracted signature from long format:', { 
            originalLength: signature.length,
            extractedLength: extractedHex.length,
            extractionSuccessful: extractedHex.length === 130,
            walletType
          });
        }

        // Validate final signature length
        if (extractedHex.length !== 130) {
          throw new Error(`Invalid signature length: expected 130 hex chars, got ${extractedHex.length}`);
        }

        // Convert hex to Uint8Array as required by XMTP
        const uint8ArraySignature = new Uint8Array(65);
        for (let i = 0; i < extractedHex.length; i += 2) {
          uint8ArraySignature[i / 2] = parseInt(extractedHex.substr(i, 2), 16);
        }

        console.log('[Wagmi Signer] ✅ Final signature conversion:', { 
          uint8ArrayLength: uint8ArraySignature.length,
          isUint8Array: uint8ArraySignature instanceof Uint8Array,
          firstFewBytes: Array.from(uint8ArraySignature.slice(0, 5)),
          lastFewBytes: Array.from(uint8ArraySignature.slice(-5)),
          walletType
        });

        return uint8ArraySignature;
      } catch (error: any) {
        console.error('[Wagmi Signer] ❌ Signing failed:', error);
        throw error;
      }
    },

    // Additional methods for compatibility
    getAddress() {
      return account.address.toLowerCase();
    },
    
    // Legacy XMTP v2 compatibility
    getIdentity() {
      return {
        kind: 'ETHEREUM' as const,
        identifier: account.address.toLowerCase(),
      };
    },

    // Additional properties
    address: account.address.toLowerCase(),
    _isSigner: true,
    _isXmtpSigner: true,
    _isWagmiSigner: true,

    // Required for Smart Contract Wallets: getChainId method
    ...(isSmartWallet && {
      getChainId() {
        // Return the chain ID for the wallet
        // Base mainnet = 8453, Ethereum mainnet = 1
        const chainId = walletClient.chain?.id || 8453; // Default to Base
        console.log('[Wagmi Signer] 🔗 Chain ID for SCW:', chainId);
        return BigInt(chainId);
      }
    })
  };

  console.log('[Wagmi Signer] ✅ Created XMTP signer:', {
    type: signer.type,
    hasGetIdentifier: typeof signer.getIdentifier === 'function',
    hasSignMessage: typeof signer.signMessage === 'function',
    hasGetChainId: 'getChainId' in signer,
    address: signer.address,
    walletType
  });

  return signer;
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

  async handleSignRequest(id: string | number, payload: { message: string | Uint8Array, isSmartWallet?: boolean }) {
    try {
      console.log('[Worker API] Handling sign request:', { id, messageType: typeof payload.message });
      
      if (!this.walletClient) {
        throw new Error('Wallet client not available for signing');
      }
      
      // Use the Smart Wallet detection result passed from the main thread
      const isSmartWallet = payload.isSmartWallet || false;
      
      if (isSmartWallet) {
        console.log('[Worker API] 🤖 Processing signature request for Smart Wallet - may require user confirmation');
      }
      
      const signer = walletClientToXmtpSigner(this.walletClient, isSmartWallet);
      
      // Add timeout for Smart Wallet signatures - increased base timeout for Firebase
      const signTimeout = isSmartWallet ? 45000 : 25000; // 45s for Smart Wallet, 25s for EOA
      console.log(`[Worker API] ⏰ Using ${signTimeout/1000}s timeout for signature`);
      
      const signature = await Promise.race([
        signer.signMessage(payload.message),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Signature timeout after ${signTimeout/1000}s`)), signTimeout)
        )
      ]);
      
      console.log('[Worker API] Signature received:', { 
        signatureLength: signature.length,
        signatureType: signature.constructor.name,
        isUint8Array: signature instanceof Uint8Array,
        isSmartWallet,
        expectedLength: signature.length === 65 ? 'correct (65 bytes)' : `unexpected (${signature.length} bytes)`,
        firstFewBytes: Array.from(signature.slice(0, 10)),
        lastFewBytes: Array.from(signature.slice(-5))
      });
      
      // Validate signature before conversion
      if (!signature || signature.length === 0) {
        throw new Error('Empty or invalid signature received');
      }
      
      // Convert Uint8Array to regular array for postMessage serialization
      const signatureArray = Array.from(signature);
      console.log('[Worker API] Converting signature for postMessage:', { 
        originalLength: signature.length,
        arrayLength: signatureArray.length,
        conversionValid: signatureArray.length === signature.length,
        firstFewArrayBytes: signatureArray.slice(0, 10)
      });
      
      // Validate conversion
      if (signatureArray.length !== signature.length) {
        throw new Error(`Signature conversion failed: ${signature.length} -> ${signatureArray.length}`);
      }
      
      // Send signature as regular array to Worker
      this.worker.postMessage({
        id,
        type: 'signResponse',
        success: true,
        payload: { signature: signatureArray }
      });
      
      console.log('[Worker API] ✅ Signature sent to Worker successfully');
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
  isSmartWallet: boolean;
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
  const [isSmartWallet, setIsSmartWallet] = useState(false);
  const clientRef = useRef<any>(null);

  // Get wallet connection state from OnchainKit/Wagmi
  const { address, isConnected: isWalletConnected, connector } = useAccount();
  const { data: walletClient } = useWalletClient();

  const MAX_CONNECTION_ATTEMPTS = 2;
  const CONNECTION_COOLDOWN = 15000;

    // Simple Smart Wallet detection for XMTP compatibility
  const detectSmartWallet = useCallback(async (walletAddress: string): Promise<boolean> => {
    try {
      console.log('[XMTP Context] 🔍 Checking wallet compatibility for XMTP:', walletAddress);
      
      // Log basic wallet info for debugging
      console.log('[XMTP Context] 🔍 Wallet info:', {
        connectorId: connector?.id,
        connectorName: connector?.name,
        accountType: walletClient?.account?.type,
        hasWindowEthereum: !!window.ethereum,
        isCoinbaseWallet: window.ethereum?.isCoinbaseWallet,
        isMetaMask: window.ethereum?.isMetaMask
      });
      
      // Check if this is a Smart Contract Wallet via account type
      const isSmartContractWallet = walletClient?.account?.type === 'smart';
      
      if (isSmartContractWallet) {
        console.log('[XMTP Context] 🚫 Smart Contract Wallet detected - XMTP not supported');
        return true;
      }
      
      // Check if account has contract code (smart contract)
      try {
        const code = await window.ethereum?.request({
          method: 'eth_getCode',
          params: [walletAddress, 'latest']
        });
        
        const isContract = code && code !== '0x' && code !== '0x0';
        
        if (isContract) {
          console.log('[XMTP Context] 🚫 Smart Contract detected via code check - XMTP not supported');
          return true;
        }
      } catch (codeError) {
        console.warn('[XMTP Context] ⚠️ Could not check contract code:', codeError);
      }
      
      console.log('[XMTP Context] ✅ EOA wallet detected - XMTP should work');
      return false;
    } catch (error) {
      console.warn('[XMTP Context] ⚠️ Error detecting wallet type:', error);
      // Default to false (assume EOA) if detection fails
      return false;
    }
  }, [connector, walletClient]);

  const initXmtpClient = useCallback(async () => {
    // Check limits to prevent infinite loop
    if (!walletClient || !address || isConnecting || isConnected) return;
    
    // Check if this is a Smart Wallet (for UI display only)
    const isSmartWalletDetected = await detectSmartWallet(address);
    setIsSmartWallet(isSmartWalletDetected);
    
    // CRITICAL: Disable XMTP for Smart Wallets due to XMTP browser-sdk v2.1.1 compatibility issues
    if (isSmartWalletDetected) {
      console.log('[XMTP Context] 🚫 Smart Wallet detected - XMTP disabled due to browser-sdk v2.1.1 compatibility issues');
      console.log('[XMTP Context] ℹ️ Smart Wallets will work for all other features except messaging');
      console.log('[XMTP Context] 💡 XMTP support for Smart Wallets will be available in future SDK versions');
      
      // Set wallet address but skip XMTP initialization
      setWalletAddress(address);
      setIsConnecting(false);
      setIsConnected(false); // Keep XMTP disconnected for Smart Wallets
      return;
    }
    
    console.log('[XMTP Context] 📝 EOA wallet detected - proceeding with XMTP initialization');
    
    // Check number of attempts for this address
    if (lastFailedAddress === address && connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
      console.log(`[XMTP Context] Max connection attempts (${MAX_CONNECTION_ATTEMPTS}) reached for ${address}. Skipping...`);
      return;
    }

        console.log(`[XMTP Context] Wallet connected. Initializing XMTP client... (attempt ${connectionAttempts + 1})`);
    console.log(`[XMTP Context] Using wagmi walletClient for signing`);
    setIsConnecting(true);

    try {
      setWalletAddress(address);
      
      // Try Worker first, then fallback to main thread
      let workerSuccess = false;
      
      try {
        console.log(`[XMTP Context] Initializing client for ${address} via Worker...`);

        // Set the wallet client for signing operations
        xmtpWorkerApi.setWalletClient(walletClient);

        // For Smart Wallets, set extended timeout
        const extendedTimeout = isSmartWalletDetected ? 60000 : 30000; // 60s for Smart Wallet, 30s for EOA
        console.log(`[XMTP Context] Using ${extendedTimeout/1000}s timeout for ${isSmartWalletDetected ? 'Smart Wallet' : 'EOA'}`);

        // Instead of passing the signer object (which can't be cloned),
        // we pass only the wallet address and handle signing in the main thread
        await xmtpWorkerApi.post('initClient', { 
          walletAddress: address,
          isSmartWallet: isSmartWalletDetected,
          timeout: extendedTimeout
        });

        workerSuccess = true;
        console.log('[XMTP Context] Worker-based client initialized successfully.');
      } catch (workerError) {
        console.warn('[XMTP Context] ⚠️ Worker initialization failed, trying main thread fallback...', workerError);
        
        // Main thread fallback
        try {
          console.log(`[XMTP Context] 🔄 Fallback: Creating XMTP client directly in main thread...`);
          
          // Import XMTP Client dynamically to avoid issues
          const { Client } = await import('@xmtp/browser-sdk');
          
          // Create signer from walletClient
          const signer = walletClientToXmtpSigner(walletClient, isSmartWalletDetected);
          
          console.log(`[XMTP Context] 🔧 Creating signer for main thread...`);
          console.log(`[XMTP Context] 🔧 Signer methods:`, {
            hasGetAddress: typeof signer.getAddress === 'function',
            hasGetIdentity: typeof signer.getIdentity === 'function',
            hasGetIdentifier: typeof signer.getIdentifier === 'function', 
            hasSignMessage: typeof signer.signMessage === 'function',
            hasAddress: 'address' in signer,
            hasIsSigner: '_isSigner' in signer,
            hasIsXmtpSigner: '_isXmtpSigner' in signer,
            type: signer.type,
            address: signer.address
          });
          
          // Create client directly
          const client = await Client.create(signer, {
            apiUrl: undefined // Use default
          });
          
          // Store client reference
          clientRef.current = { client, address };
          workerSuccess = true; // Mark as success for main thread
          console.log('[XMTP Context] ✅ Main thread client created successfully!');
          
        } catch (mainThreadError) {
          console.error('[XMTP Context] ❌ Main thread fallback also failed:', mainThreadError);
          throw mainThreadError; // Re-throw to trigger retry logic
        }
      }

      if (workerSuccess) {
        setIsConnected(true);
        setConnectionAttempts(0); // Reset counter on success
        setLastFailedAddress(undefined);
        setIsConnecting(false); // Always reset isConnecting on success
      }
      
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
      setWalletAddress(address); // Still set wallet address even if XMTP fails
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
      } else {
        console.log('[XMTP Context] ℹ️ Max retries reached - wallet will work without XMTP messaging');
      }
    }
  }, [walletClient, address, isConnected, connectionAttempts, lastFailedAddress, isWalletConnected, detectSmartWallet]);
  
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
    
    // Check if we have a main thread client
    if (clientRef.current && 'client' in clientRef.current) {
      console.log(`[XMTP Context] 🚀 Sending message to ${to} via main thread client...`);
      
      try {
        const client = clientRef.current.client;
        const conversation = await client.conversations.newDm(to);
        await conversation.send(message);
        
        console.log(`[XMTP Context] ✅ Message sent successfully via main thread`);
        return { success: true };
      } catch (error) {
        console.error(`[XMTP Context] ❌ Main thread message send failed:`, error);
        throw error;
      }
    } else {
      // Fallback to Worker
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
    }
  }, [isConnected]);

  const getConversationHistory = useCallback(async (): Promise<any[]> => {
    if (!isConnected || !walletAddress) {
      console.log('[XMTP Context] Not connected, returning empty history.');
      return [];
    }
    
    try {
      console.log('[XMTP Context] 📖 Getting hybrid history (XMTP + Firestore)...');
      
      let xmtpHistory: any[] = [];
      
      // Check if we have a main thread client
      if (clientRef.current && 'client' in clientRef.current) {
        console.log('[XMTP Context] 📖 Getting history from main thread client...');
        
        try {
          const client = clientRef.current.client;
          const conversations = await client.conversations.list();
          
          for (const conversation of conversations.slice(0, 5)) { // Limit to 5 conversations
            const messages = await conversation.messages();
            xmtpHistory.push(...messages.slice(-10)); // Last 10 messages per conversation
          }
          
          console.log(`[XMTP Context] 📊 Main thread history: ${xmtpHistory.length} messages`);
        } catch (error) {
          console.warn('[XMTP Context] ⚠️ Main thread history failed, using empty array:', error);
          xmtpHistory = [];
        }
      } else {
        // Fallback to Worker
        try {
          const workerResult = await xmtpWorkerApi.post('getHistory', {});
          xmtpHistory = Array.isArray(workerResult) ? workerResult : [];
        } catch (error) {
          console.warn('[XMTP Context] ⚠️ Worker history failed, using empty array:', error);
          xmtpHistory = [];
        }
      }
      
      // Get history from both sources in parallel
      const [, firestoreHistory] = await Promise.all([
        Promise.resolve(xmtpHistory), // Already fetched above
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
    isSmartWallet,
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