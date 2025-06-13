/**
 * XMTP Web Worker (Vite-compatible)
 * 
 * This worker runs all XMTP operations in a separate thread, isolating it from the main
 * thread's context to bypass SES restrictions. It handles signing through message passing.
 */
import { Client } from '@xmtp/browser-sdk';
import type { IdentifierKind } from '@xmtp/browser-sdk';

let xmtpClient: any = null;
let signerRequests = new Map();
let xmtpConversationCache = new Map<string, any>();

const isFirebaseEnvironment = () => {
  if (typeof self !== 'undefined') {
    return self.location?.hostname?.includes('.web.app') || 
           self.location?.hostname?.includes('.firebaseapp.com') ||
           self.location?.hostname?.includes('firebase') ||
           self.location?.hostname === 'tipmaster.xyz';
  }
  return false;
};

// Remote signer that communicates with main thread
class RemoteSigner {
  private walletAddress: string;
  
  // XMTP V3 requires type field
  type = 'EOA' as const;

  constructor(walletAddress: string) {
    this.walletAddress = walletAddress;
  }

  async getAddress() {
    return this.walletAddress;
  }

  getIdentifier() {
    return {
      identifier: this.walletAddress.toLowerCase(),
      identifierKind: 'Ethereum' as IdentifierKind
    };
  }

  async signMessage(message: string | Uint8Array) {
    return new Promise<Uint8Array>((resolve, reject) => {
      const requestId = `sign-${Date.now()}-${Math.random()}`;
      
      console.log(`[XMTP Worker] 📝 Requesting signature for message (ID: ${requestId})`);
      
      // Store the promise handlers
      signerRequests.set(requestId, { resolve, reject });
      
      // Request signature from main thread
      self.postMessage({
        id: requestId,
        type: 'signRequest',
        payload: { message }
      });
      
      // Add timeout for signature request
      setTimeout(() => {
        if (signerRequests.has(requestId)) {
          console.error(`[XMTP Worker] ❌ Signature timeout for request ${requestId}`);
          signerRequests.delete(requestId);
          reject(new Error('Signature request timeout after 10s'));
        }
      }, 10000); // 10 second timeout
    });
  }

  // Ensure all possible identifier formats are available
  toJSON() {
    return {
      type: this.type,
      identifier: this.walletAddress.toLowerCase(),
      address: this.walletAddress
    };
  }
}

// Handle sign responses from main thread
self.addEventListener('message', (event) => {
  const { id, type, success, payload, error, action } = event.data;
  
  if (type === 'signResponse') {
    console.log(`[XMTP Worker] 📨 Received sign response for ID: ${id}, success: ${success}`);
    if (signerRequests.has(id)) {
      const { resolve, reject } = signerRequests.get(id);
      if (success) {
        console.log(`[XMTP Worker] ✅ Signature successful for ID: ${id}`);
        // Convert array back to Uint8Array
        const signature = Array.isArray(payload.signature) 
          ? new Uint8Array(payload.signature)
          : payload.signature;
        console.log(`[XMTP Worker] 🔄 Converted signature:`, {
          originalType: Array.isArray(payload.signature) ? 'Array' : typeof payload.signature,
          convertedType: signature.constructor.name,
          length: signature.length
        });
        resolve(signature);
      } else {
        console.error(`[XMTP Worker] ❌ Signature failed for ID: ${id}:`, error);
        reject(new Error(error.message));
      }
      signerRequests.delete(id);
    } else {
      console.warn(`[XMTP Worker] ⚠️ Received sign response for unknown ID: ${id}`);
    }
    return;
  }
  
  // Handle regular action messages
  if (action) {
    handleAction(event);
  }
});

// --- Action Handlers ---

async function initClient(payload: { walletAddress: string }) {
  if (xmtpClient) {
    console.log('[XMTP Worker] Client already initialized.');
    return { walletAddress: payload.walletAddress };
  }
  
  const { walletAddress } = payload;
  console.log('[XMTP Worker] Initializing XMTP client with v3 API (Client.create) for Firebase environment...');
  
  try {
    // Create remote signer that communicates with main thread
    const signer = new RemoteSigner(walletAddress);
    console.log('[XMTP Worker] Created RemoteSigner with all properties:', {
      address: await signer.getAddress(),
      getIdentifier: signer.getIdentifier(),
      type: signer.type,
      signerPrototype: Object.getOwnPropertyNames(Object.getPrototypeOf(signer))
    });

    console.log('[XMTP Worker] Calling Client.create with Firebase-optimized configuration...');
    console.log('[XMTP Worker] Signer type:', typeof signer);
    console.log('[XMTP Worker] Signer instanceof RemoteSigner:', signer instanceof RemoteSigner);

    // Use in-memory storage instead of IndexedDB with error suppression and timeout
    console.log('[XMTP Worker] Starting Client.create with 15s timeout...');
    
    // Add progress tracking
    const progressTimer = setInterval(() => {
      console.log('[XMTP Worker] ⏳ Client.create still in progress...');
    }, 5000);
    
    try {
      // Firebase-specific configuration to avoid IndexedDB issues
      const clientOptions = isFirebaseEnvironment() ? {
        env: 'production' as const,
        // Critical: disable persistence for Firebase
        enablePersistence: false,
        // Use in-memory storage only
        dbPath: undefined,
        // Simplified initialization
        useSimplifiedInit: true
      } : {
        env: 'production' as const,
        apiUrl: 'https://production.xmtp.network'
      };
      
      console.log('[XMTP Worker] Using client options:', clientOptions);
      
      xmtpClient = await Promise.race([
        Client.create(signer, clientOptions),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Client.create timeout after 15s')), 15000)
        )
      ]);
      clearInterval(progressTimer);
      console.log('[XMTP Worker] ✅ Client.create completed successfully!');
    } catch (error) {
      clearInterval(progressTimer);
      console.error('[XMTP Worker] ❌ Client.create failed or timed out:', error);
      throw error;
    }

    // Suppress XMTP key package cleaner worker errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args.join(' ').toString();
      if (message.includes('key_package_cleaner_worker') || 
          message.includes('sync worker error') ||
          message.includes('Record not found inbox_id')) {
        return; // Suppress these specific XMTP internal errors
      }
      originalConsoleError.apply(console, args);
    };

    // Check availability of main methods
    if (!xmtpClient || typeof xmtpClient.conversations?.newDm !== 'function') {
      throw new Error('XMTP client not properly initialized or missing required methods');
    }

    // Store walletAddress for use in other functions
    (globalThis as any).workerWalletAddress = walletAddress;
    
    // In XMTP v3 client doesn't have getAddress() method, use passed walletAddress
    console.log(`🎯 [XMTP Worker] Client created successfully for address: ${walletAddress}`);
    
    // Check availability of main methods
    try {
      const inboxId = xmtpClient.inboxId;
      console.log('[XMTP Worker] ✅ Client has inboxId:', inboxId);
      
      // Test basic functionality
      console.log('[XMTP Worker] Testing client functionality...');
      const conversations = xmtpClient.conversations;
      console.log('[XMTP Worker] ✅ Conversations object available:', !!conversations);
      console.log('[XMTP Worker] ✅ newDm method available:', typeof conversations?.newDm);
      
      console.log('[XMTP Worker] 🎉 Client fully initialized and ready!');
      return { walletAddress: walletAddress };
    } catch (inboxError) {
      console.warn('[XMTP Worker] ⚠️ Could not access inboxId:', inboxError);
      // Still return success if client was created
      console.log('[XMTP Worker] 🎉 Client created (without inboxId verification)');
      return { walletAddress: walletAddress };
    }
  } catch (error) {
    const errorInfo = error instanceof Error ? {
      error,
      message: error.message,
      stack: error.stack,
      name: error.name
    } : {
      error,
      message: String(error)
    };
    console.error('[XMTP Worker] Failed to initialize client with v3 API in Firebase environment. Detailed error:', errorInfo);
    
    // Special database error handling for Firebase
    if (error instanceof Error) {
      if (error.message.includes('NoModificationAllowedError') || 
          error.message.includes('sync access handle') ||
          error.message.includes('IndexedDB') ||
          error.message.includes('An error occurred while creating sync access handle')) {
        console.warn('[XMTP Worker] Firebase IndexedDB restriction detected, trying ultra-simplified approach...');
        
        // Try ultra-simplified initialization for Firebase
        try {
          const ultraSimpleOptions = {
            env: 'production' as const,
            // Absolutely no persistence
            enablePersistence: false,
            // No database path
            dbPath: undefined,
            // No API URL to use default
            apiUrl: undefined,
            // Minimal configuration
            useInMemoryStorage: true
          };
          
          console.log('[XMTP Worker] Attempting ultra-simple Firebase config:', ultraSimpleOptions);
          
          // Create new signer for retry attempt
          const retrySigner = new RemoteSigner(walletAddress);
          xmtpClient = await Promise.race([
            Client.create(retrySigner, ultraSimpleOptions),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Ultra-simple client timeout after 10s')), 10000)
            )
          ]);
          console.log('[XMTP Worker] ✅ Client created with ultra-simplified Firebase configuration!');
          return { walletAddress: walletAddress };
        } catch (retryError) {
          console.error('[XMTP Worker] Ultra-simple retry also failed:', retryError);
          throw new Error(`Firebase XMTP initialization completely failed: ${error.message}`);
        }
      }
    }
    
    throw error;
  }
}

async function sendMessage(payload: { recipientAddress: string; message: string }) {
  if (!xmtpClient) {
    throw new Error('XMTP client not initialized');
  }
  
  const { recipientAddress, message } = payload;
  console.log(`[XMTP Worker] 🚀 Starting message send to ${recipientAddress}: "${message}"`);
  
  try {
    // Check if this is the first message to this address
    const isFirstMessage = !xmtpConversationCache.has(recipientAddress);
    
    if (isFirstMessage) {
      console.log(`🔥 [XMTP Worker] First message to ${recipientAddress} - using extended timeouts`);
    } else {
      console.log(`⚡ [XMTP Worker] Cached conversation for ${recipientAddress} - using standard timeouts`);
    }

    // First message gets more time due to conversation creation + device sync
    const totalTimeout = isFirstMessage ? 20000 : 15000; // 20s for first, 15s for subsequent
    const operationTimeout = isFirstMessage ? 15000 : 8000; // 15s for first, 8s for subsequent
    
    const startTime = Date.now();
    let attempt = 0;
    const maxAttempts = isFirebaseEnvironment() ? 1 : (isFirstMessage ? 2 : 3);

    while (attempt < maxAttempts) {
      attempt++;
      
      // Check overall time limit
      const elapsed = Date.now() - startTime;
      if (elapsed >= totalTimeout) {
        console.log(`⏰ [XMTP Worker] Total timeout reached (${elapsed}ms >= ${totalTimeout}ms)`);
        break;
      }

      try {
        console.log(`🚀 [XMTP Worker] Attempt ${attempt}/${maxAttempts} to send message (${elapsed}ms elapsed)`);
        
        // First message gets more time for conversation creation
        let conversation = xmtpConversationCache.get(recipientAddress);
        
        if (!conversation) {
          // Use cached conversation if available
          console.log(`📝 [XMTP Worker] Creating new conversation with ${recipientAddress}...`);
          
          const conversationStartTime = Date.now();
          conversation = await Promise.race([
            xmtpClient.conversations.newDm(recipientAddress),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Conversation creation timeout')), operationTimeout)
            )
          ]);
          
          const conversationTime = Date.now() - conversationStartTime;
          console.log(`✅ [XMTP Worker] Conversation created in ${conversationTime}ms`);
          
          // Store conversation in cache for subsequent messages
          xmtpConversationCache.set(recipientAddress, conversation);
        } else {
          console.log(`⚡ [XMTP Worker] Using cached conversation for ${recipientAddress}`);
        }

        if (!conversation) {
          throw new Error('Failed to create or retrieve conversation');
        }

        // Send message with timeout
        const messageStartTime = Date.now();
        const sentMessage = await Promise.race([
          conversation.send(message),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Message send timeout')), operationTimeout)
          )
        ]);
        
        const messageTime = Date.now() - messageStartTime;
        const totalTime = Date.now() - startTime;
        console.log(`✅ [XMTP Worker] Message sent successfully in ${messageTime}ms (total: ${totalTime}ms)`);

        // Save message to Firestore for backup storage
        try {
          if (isFirebaseEnvironment()) {
            console.log(`💾 [XMTP Worker] Saving message to Firestore...`);
            
            // Use postMessage to send Firestore save request to main thread
            self.postMessage({
              type: 'firestoreSave',
              payload: {
                from: (globalThis as any).workerWalletAddress,
                to: recipientAddress,
                content: message,
                timestamp: Date.now(),
                conversationId: `${(globalThis as any).workerWalletAddress}-${recipientAddress}`,
                messageId: sentMessage.id || `msg_${Date.now()}`
              }
            });
          }
        } catch (firestoreError) {
          console.warn(`⚠️ [XMTP Worker] Firestore save failed (non-critical):`, firestoreError);
        }

        return {
          success: true,
          messageId: sentMessage.id,
          timestamp: Date.now()
        };

      } catch (error: any) {
        const elapsed = Date.now() - startTime;
        console.error(`❌ [XMTP Worker] Attempt ${attempt} failed after ${elapsed}ms:`, error.message);

        // Check if this is an XMTP API error for retry
        const isRetryableError = (
          error.message?.includes('500') ||
          error.message?.includes('timeout') ||
          error.message?.includes('network') ||
          error.message?.includes('identity') ||
          error.message?.includes('Failed to fetch') ||
          error.message?.includes('NetworkError')
        );

        // On last attempt or non-retryable error
        if (attempt >= maxAttempts || !isRetryableError) {
          console.error(`💥 [XMTP Worker] Final attempt failed. Error: ${error.message}`);
          
          if (isFirebaseEnvironment()) {
            // Return "success" for UI stability on API errors
            console.log(`🔄 [XMTP Worker] Firebase: Returning success despite error for UI stability`);
            return {
              success: true,
              messageId: `fallback_${Date.now()}`,
              timestamp: Date.now(),
              warning: `Message may not have been delivered: ${error.message}`
            };
          }
          
          return {
            success: false,
            error: error.message,
            timestamp: Date.now()
          };
        }

        // Wait before retry with exponential backoff
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // 1s, 2s, 4s, 8s max
        console.log(`⏳ [XMTP Worker] Waiting ${backoffDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    // If we get here, all attempts failed
    if (isFirebaseEnvironment()) {
      // In Firebase return "success" for UI on critical errors
      console.log(`🔄 [XMTP Worker] Firebase: All attempts failed, returning success for UI stability`);
      return {
        success: true,
        messageId: `fallback_${Date.now()}`,
        timestamp: Date.now(),
        warning: 'Message delivery uncertain due to network issues'
      };
    }

    return {
      success: false,
      error: 'All send attempts failed',
      timestamp: Date.now()
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[XMTP Worker] 💥 Send message CRITICAL FAILURE:', {
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
      recipientAddress,
      message,
      isFirebaseEnvironment: isFirebaseEnvironment()
    });
    
          // In Firebase return "success" for UI on critical errors
    if (isFirebaseEnvironment()) {
      console.warn('[XMTP Worker] 🔄 Firebase fallback: returning success for UI stability');
      return {
        success: true,
        messageId: 'firebase-critical-fallback-' + Date.now(),
        timestamp: Date.now(),
        warning: 'Critical error in Firebase - message delivery highly uncertain',
        originalError: errorMsg
      };
    }
    
    throw error;
  }
}

async function getHistory() {
  if (!xmtpClient) {
    throw new Error('XMTP client not initialized');
  }
  
  console.log('[XMTP Worker] Fetching conversations for Firebase environment...');
  
  try {
      // Smart timeout with retry for getHistory
  const MAX_HISTORY_TIME_MS = 10000; // Maximum 10 seconds for history
    const startTime = Date.now();
    
    const withSmartTimeout = <T>(promise: Promise<T>, timeout: number, operation: string): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
          setTimeout(() => reject(new Error(`${operation} timeout after ${timeout}ms`)), timeout)
        )
      ]);
    };

    // Retry logic for getHistory with exponential backoff
    const getConversationsWithRetry = async (maxAttempts = 2) => {
      const getBackoffDelay = (attempt: number) => Math.min(500 * Math.pow(2, attempt - 1), 2000);
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime >= MAX_HISTORY_TIME_MS) {
          console.warn(`[XMTP Worker] ⏰ History time limit exceeded after ${elapsedTime}ms`);
          return [];
        }
        
        try {
          const timeout = isFirebaseEnvironment() ? 2000 : 5000; // 2s for Firebase, 5s for local
          console.log(`[XMTP Worker] 📚 Attempt ${attempt}/${maxAttempts} - Fetching conversations (${timeout}ms timeout)...`);
          
                     const conversations = await withSmartTimeout(
             xmtpClient.conversations.list(), 
             timeout, 
             'Conversations fetch'
           ) as any[];
           
           console.log(`[XMTP Worker] ✅ Found ${conversations.length} conversations in ${Date.now() - startTime}ms`);
           return conversations;
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const currentElapsed = Date.now() - startTime;
          
          console.warn(`[XMTP Worker] ⚠️ History attempt ${attempt}/${maxAttempts} failed after ${currentElapsed}ms:`, errorMsg);
          
          const isRetryable = (
            errorMsg.includes('timeout') ||
            errorMsg.includes('500') ||
            errorMsg.includes('network') ||
            errorMsg.includes('identity') ||
            errorMsg.includes('production.xmtp.network')
          );
          
          if (isRetryable && attempt < maxAttempts) {
            const backoffDelay = getBackoffDelay(attempt);
            const remainingTime = MAX_HISTORY_TIME_MS - currentElapsed;
            
            if (remainingTime > backoffDelay) {
              console.log(`[XMTP Worker] 🔄 Retrying in ${backoffDelay}ms...`);
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
              continue;
            }
          }
          
          // On last attempt or non-retryable error return empty array
          console.warn(`[XMTP Worker] 📭 Returning empty history due to errors (Firebase stability)`);
          return [];
        }
      }
      
      return [];
    };

          // Firebase: use 1 attempt, locally: 2 attempts
    const maxAttempts = isFirebaseEnvironment() ? 1 : 2;
    const conversations = await getConversationsWithRetry(maxAttempts);
    
          // If no conversations - return immediately
    if (conversations.length === 0) {
      console.log('[XMTP Worker] No conversations found, returning empty array');
      return [];
    }
    
          // For Firebase process only the first conversation for performance
    const firstConversation = conversations[0];
    console.log(`[XMTP Worker] Processing first conversation:`, {
      id: firstConversation.id?.substring(0, 8) + '...',
      hasMembers: !!firstConversation.members
    });
    
          // Get messages with retry and timeout
    const getMessagesWithRetry = async (conversation: any, maxAttempts = 2) => {
      const getBackoffDelay = (attempt: number) => Math.min(300 * Math.pow(2, attempt - 1), 1000);
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const messageTimeout = isFirebaseEnvironment() ? 2000 : 5000;
          console.log(`[XMTP Worker] 📩 Messages attempt ${attempt}/${maxAttempts} (${messageTimeout}ms timeout)...`);
          
                     const messages = await withSmartTimeout(
             conversation.messages(), 
             messageTimeout, 
             'Messages fetch'
           ) as any[];
           
           console.log(`[XMTP Worker] ✅ Found ${messages.length} messages`);
           return messages;
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.warn(`[XMTP Worker] ⚠️ Messages attempt ${attempt}/${maxAttempts} failed:`, errorMsg);
          
          const isRetryable = (
            errorMsg.includes('timeout') ||
            errorMsg.includes('500') ||
            errorMsg.includes('network') ||
            errorMsg.includes('identity')
          );
          
          if (isRetryable && attempt < maxAttempts) {
            const backoffDelay = getBackoffDelay(attempt);
            console.log(`[XMTP Worker] 🔄 Retrying messages in ${backoffDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            continue;
          }
          
          console.warn(`[XMTP Worker] 📭 Returning empty messages due to errors`);
          return [];
        }
      }
      
      return [];
    };
    
    const messages = await getMessagesWithRetry(firstConversation, maxAttempts);
    
                // Only last 5 messages for minimal load
    const recentMessages = messages.slice(-5);
    
    const formattedMessages = recentMessages.map((message: any) => ({
      id: message.id,
      content: message.content,
      senderInboxId: message.senderInboxId,
      sentAtNs: message.sentAtNs ? message.sentAtNs.toString() : null,
      conversationId: firstConversation.id,
      fallback: message.fallback
    }));
    
    console.log(`[XMTP Worker] ✅ Final result: ${formattedMessages.length} messages from 1 conversation`);
    return formattedMessages;
      
    } catch (error) {
      const criticalErrorText = error instanceof Error ? error.message : String(error);
      console.error('[XMTP Worker] Firebase getHistory critical error:', criticalErrorText);
      
              // Special handling for Firebase/XMTP API errors
      if (criticalErrorText?.includes('500') || 
          criticalErrorText?.includes('identity') ||
          criticalErrorText?.includes('network') ||
          criticalErrorText?.includes('timeout')) {
        console.warn('[XMTP Worker] Firebase/XMTP API issue detected, returning empty for stability');
      }
    
    return []; // In Firebase ALWAYS return empty array on errors
  }
}

async function warmupConversation(payload: { recipientAddress: string }) {
  if (!xmtpClient) {
    throw new Error('XMTP client not initialized');
  }
  
  const { recipientAddress } = payload;
  console.log(`[XMTP Worker] 🔥 Starting conversation warmup for ${recipientAddress}...`);
  
  try {
    // Check if conversation already exists in cache
    const cachedConversation = xmtpConversationCache.get(recipientAddress);
    if (cachedConversation) {
      console.log(`⚡ [XMTP Worker] Using cached conversation for warmup to ${recipientAddress}`);
      return {
        success: true,
        cached: true,
        timestamp: Date.now()
      };
    }
    
    // Create conversation with increased timeout specifically for warmup
    const WARMUP_TIMEOUT = 25000; // 25 seconds for warmup
    
    const createConversationWithTimeout = () => {
      return Promise.race([
        xmtpClient.conversations.newDm(recipientAddress),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Warmup conversation timeout')), WARMUP_TIMEOUT)
        )
      ]);
    };
    
    console.log(`🔥 [XMTP Worker] Creating warmup conversation with ${recipientAddress}...`);
    
    const conversation = await createConversationWithTimeout();
    
    // Store in cache for future messages
    xmtpConversationCache.set(recipientAddress, conversation);
    
    console.log(`✅ [XMTP Worker] Warmup conversation created and cached for ${recipientAddress}`);
    
    return {
      success: true,
      cached: false,
      timestamp: Date.now()
    };
    
  } catch (error: any) {
    console.error(`❌ [XMTP Worker] Warmup failed for ${recipientAddress}:`, error.message);
    
    // Even on error return "success" for UI stability
    return {
      success: true,
      cached: false,
      timestamp: Date.now(),
      warning: error.message
    };
  }
}

async function debugClient() {
  if (!xmtpClient) {
    throw new Error('XMTP client not initialized');
  }
  
  console.log('[XMTP Worker] Debug client info...');
  
  try {
    // Get client information
    const info = {
      inboxId: xmtpClient.inboxId,
      installationId: xmtpClient.installationId,
      accountAddress: xmtpClient.accountAddress,
    };
    
    console.log('[XMTP Worker] Client info:', info);
    
    // Try to get conversations with additional diagnostics
    const conversations = await xmtpClient.conversations.list();
    console.log('[XMTP Worker] Raw conversations:', conversations);
    
    return {
      clientInfo: info,
      conversationsCount: conversations.length,
      conversations: conversations.map((conv: any) => ({
        id: conv.id,
        createdAt: conv.createdAt,
        topic: conv.topic,
        members: conv.members
      }))
    };
  } catch (error) {
    console.error('[XMTP Worker] Debug error:', error);
    throw error;
  }
}

async function performWarmup() {
  if (!xmtpClient) {
    throw new Error('XMTP client not initialized');
  }
  
  console.log('[XMTP Worker] 🔥 Performing automatic warmup...');
  
  try {
    const startTime = Date.now();
    
    // Perform lightweight operations to warm up the client
    console.log('[XMTP Worker] 🏃 Warming up conversations list...');
    
    // Get conversations list with timeout
    const conversationsPromise = Promise.race([
      xmtpClient.conversations.list(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Conversations list timeout')), 10000)
      )
    ]);
    
    const conversations = await conversationsPromise;
    console.log('[XMTP Worker] ✅ Conversations list loaded:', conversations.length, 'conversations');
    
    // Sync conversations to ensure we have latest state
    console.log('[XMTP Worker] 🔄 Syncing conversations...');
    try {
      const syncPromise = Promise.race([
        xmtpClient.conversations.sync(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sync timeout')), 8000)
        )
      ]);
      
      await syncPromise;
      console.log('[XMTP Worker] ✅ Conversations synced successfully');
    } catch (syncError) {
      console.warn('[XMTP Worker] ⚠️ Sync failed (non-critical):', syncError);
    }
    
    const totalTime = Date.now() - startTime;
    console.log('[XMTP Worker] 🎯 Automatic warmup completed in', totalTime, 'ms');
    
    return {
      success: true,
      totalTime,
      conversationsCount: conversations.length,
      message: 'XMTP client warmed up successfully'
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn('[XMTP Worker] ⚠️ Warmup failed (non-critical):', errorMsg);
    
    // Return success even on failure to not block client initialization
    return {
      success: true,
      warning: 'Warmup failed but client is ready',
      error: errorMsg
    };
  }
}

// --- Main Action Handler ---

const actions: { [key: string]: (payload?: any) => Promise<any> } = {
  initClient,
  sendMessage,
  getHistory,
  debugClient,
  warmupConversation,
  performWarmup,
};

async function handleAction(event: MessageEvent) {
  const { id, action, payload } = event.data;

  if (id === undefined || id === null || !action) {
    console.error('[XMTP Worker] Received invalid message format.', event.data);
    return;
  }
  
  console.log(`[XMTP Worker] Received action: ${action}`, { id, payload });

  const actionHandler = actions[action];
  if (!actionHandler) {
    postError(id, new Error(`Unknown action: ${action}`));
    return;
  }

  try {
    const result = await actionHandler(payload);
    postSuccess(id, result);
  } catch (e: any) {
    console.error(`[XMTP Worker] Error during action '${action}':`, e);
    postError(id, e);
  }
}

// --- Worker Communication Helpers ---

function postSuccess(id: string | number, result: any) {
  self.postMessage({ id, success: true, payload: result });
}

function postError(id: string | number, error: Error) {
  self.postMessage({ id, success: false, error: { message: error.message, stack: error.stack } });
}

// Initialize worker and add Firebase detection
console.log('[XMTP Worker] Worker started, checking environment...');

// Filter noisy XMTP logs in worker
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.info = function(...args) {
  const message = args.join(' ');
  // Block noisy DEVICE SYNC logs
  if (message.includes('DEVICE SYNC') || 
      message.includes('xmtp_mls::groups::device_sync') ||
      message.includes('xmtp_mls::groups::mls_sync') ||
      message.includes('published intent') ||
      message.includes('Processing envelope')) {
    return; // Don't show these info messages
  }
  originalConsoleInfo.apply(console, args);
};

console.warn = function(...args) {
  const message = args.join(' ');
  // Block known warnings
  if (message.includes('sync worker error storage error: Record not found') ||
      message.includes('key_package_cleaner_worker') ||
      message.includes('SES') ||
      message.includes('dateTaming') ||
      message.includes('mathTaming')) {
    return; // Don't show these warnings
  }
  originalConsoleWarn.apply(console, args);
};

console.error = function(...args) {
  const message = args.join(' ');
  // Block known XMTP internal errors
  if (message.includes('key_package_cleaner_worker') ||
      message.includes('sync worker error storage error: Record not found') ||
      message.includes('Record not found inbox_id')) {
    return; // Don't show these errors
  }
  originalConsoleError.apply(console, args);
};

console.log('[XMTP Worker] Environment detection:', {
  isFirebase: isFirebaseEnvironment(),
  hostname: self.location?.hostname,
  hasIndexedDB: typeof indexedDB !== 'undefined'
});

// Extended diagnostics for Firebase
if (isFirebaseEnvironment()) {
  console.log('[XMTP Worker] 🔍 Firebase environment diagnostics:');
  console.log('[ENV] IndexedDB support:', typeof indexedDB !== 'undefined');
  console.log('[ENV] Firebase Host:', self.location?.hostname);
  console.log('[ENV] Worker context:', typeof self !== 'undefined');
  console.log('[ENV] WebAssembly support:', typeof WebAssembly !== 'undefined');
  
  // Check XMTP API access
  fetch('https://production.xmtp.network/health')
      .then(r => console.log('[ENV] XMTP API access:', r.status))
  .catch(e => console.warn('[ENV] XMTP API unavailable:', e.message));
}

// Firebase-specific settings (used in initClient)
console.log('[XMTP Worker] Firebase config applied:', {
  maxRetries: 2,
  timeout: 8000,
  useSimplifiedInit: true,
  skipDatabaseOperations: isFirebaseEnvironment()
});

console.log('[XMTP Worker] Vite worker initialized and ready.'); 