import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useXmtp } from '../contexts/XmtpContext';
import { useAccount, useWalletClient, useConnect, useDisconnect } from 'wagmi';
import { type SignableMessage } from 'viem';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warn' | 'success' | 'system';
  message: string;
  data?: any;
}

interface DiagnosticResult {
  status: 'success' | 'error' | 'warn' | 'unknown';
  message: string;
}

const XmtpDebugPage: React.FC = () => {
  const {
    connect: connectXmtp,
    disconnect: disconnectXmtp,
    sendMessage,
    getConversationHistory,
    warmupConversation,
    isConnected: xmtpConnected,
    isConnecting: xmtpConnecting
  } = useXmtp();
  
  // Wagmi hooks for modern wallet connection
  const { address: wagmiAddress, isConnected: isWagmiConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [testAddress, setTestAddress] = useState('0x742b15b19a57Ab83A7dD93a0A72B0D1EE1b69f09');
  const [testMessage, setTestMessage] = useState('Hello from XMTP!');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Legacy direct wallet connection state
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);
  
  const [diagnostics, setDiagnostics] = useState({
    sesBypass: { status: 'unknown', message: 'Not checked' } as DiagnosticResult,
    metaMask: { status: 'unknown', message: 'Not checked' } as DiagnosticResult,
    snapSupport: { status: 'unknown', message: 'Not checked' } as DiagnosticResult,
  });

  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((level: LogEntry['level'], message: string, data?: any) => {
    // Safely handle BigInt values for serialization
    const sanitizeData = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'bigint') return obj.toString();
      if (Array.isArray(obj)) return obj.map(sanitizeData);
      if (typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeData(value);
        }
        return sanitized;
      }
      return obj;
    };

    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      data: data ? sanitizeData(data) : undefined
    };
    setLogs(prev => [...prev, newLog]);
    // Also log to console for better debugging
    switch(level) {
      case 'error': console.error(`[XMTP Debug] ${message}`, data); break;
      case 'warn': console.warn(`[XMTP Debug] ${message}`, data); break;
      case 'success': console.log(`%c[XMTP Debug] ${message}`, 'color: #22c55e', data); break;
      default: console.log(`[XMTP Debug] ${message}`, data);
    }
  }, []);

  const runDiagnostics = useCallback(async () => {
    addLog('system', 'Running environment diagnostics...');

    // 1. SES Bypass Check
    if ((window as any).__DISABLE_SES__ === true) {
      setDiagnostics(prev => ({ ...prev, sesBypass: { status: 'success', message: 'SES bypass flag is set.' }}));
      addLog('success', 'Diagnostics: SES Bypass Active');
    } else {
      setDiagnostics(prev => ({ ...prev, sesBypass: { status: 'error', message: 'SES bypass flag NOT FOUND.' }}));
      addLog('error', 'Diagnostics: SES Bypass Inactive');
    }

    // 2. MetaMask Wallet Check
    if (window.ethereum && window.ethereum.isMetaMask) {
      setDiagnostics(prev => ({ ...prev, metaMask: { status: 'success', message: 'MetaMask is available.' }}));
      addLog('success', 'Diagnostics: MetaMask Detected');

      // 3. Snap Support Check
      try {
        const snapSupport = await window.ethereum.request({ method: 'wallet_getSnaps' });
        if (snapSupport) {
            setDiagnostics(prev => ({ ...prev, snapSupport: { status: 'success', message: 'MetaMask supports Snaps.' }}));
            addLog('success', 'Diagnostics: Snap Support Confirmed');
        } else {
            setDiagnostics(prev => ({ ...prev, snapSupport: { status: 'warn', message: 'wallet_getSnaps returned falsy value.' }}));
            addLog('warn', 'Diagnostics: Snap support might be limited.');
        }
      } catch (e) {
        setDiagnostics(prev => ({ ...prev, snapSupport: { status: 'error', message: 'Error checking for Snap support.' }}));
        addLog('error', 'Diagnostics: Snap Support Check Failed', e);
      }
    } else {
      setDiagnostics(prev => ({ ...prev, metaMask: { status: 'error', message: 'MetaMask not found.' }}));
      addLog('error', 'Diagnostics: MetaMask Not Found');
      setDiagnostics(prev => ({ ...prev, snapSupport: { status: 'error', message: 'Cannot check without MetaMask.' }}));
    }
  }, [addLog]);


  useEffect(() => {
    runDiagnostics();
    checkWalletConnection();
  }, [runDiagnostics]);


  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog('system', 'Logs cleared');
  }, [addLog]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const checkWalletConnection = useCallback(async () => {
    // Check wagmi connection
    if (isWagmiConnected && wagmiAddress) {
      addLog('success', `Wagmi wallet connected: ${wagmiAddress}`);
    } else {
      addLog('info', 'Wagmi wallet not connected');
    }
    
    // Check legacy direct connection
    try {
      if (!window.ethereum) {
        addLog('warn', 'No direct wallet found');
        return;
      }
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        const address = accounts[0];
        setWalletAddress(address);
        setIsWalletConnected(true);
        addLog('success', `Direct wallet already connected: ${address}`);
      } else {
        setIsWalletConnected(false);
        addLog('info', 'Direct wallet not connected');
      }
    } catch (error) {
      addLog('error', 'Error checking direct wallet connection', error);
    }
  }, [addLog, isWagmiConnected, wagmiAddress]);

  const handleConnectWagmi = useCallback(async () => {
    try {
      if (connectors.length > 0) {
        addLog('info', 'Connecting via wagmi...');
        connect({ connector: connectors[0] });
      } else {
        addLog('error', 'No wagmi connectors available');
      }
    } catch (error) {
      addLog('error', 'Failed to connect via wagmi', error);
    }
  }, [addLog, connect, connectors]);

  const handleDisconnectWagmi = useCallback(() => {
    try {
      addLog('info', 'Disconnecting wagmi wallet...');
      disconnect();
    } catch (error) {
      addLog('error', 'Failed to disconnect wagmi wallet', error);
    }
  }, [addLog, disconnect]);

  const handleConnectWallet = useCallback(async () => {
    try {
      if (!window.ethereum) {
        addLog('error', 'No wallet found. Please install MetaMask.');
        return;
      }
      addLog('info', 'Requesting direct wallet connection...');
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        const address = accounts[0];
        setWalletAddress(address);
        setIsWalletConnected(true);
        addLog('success', `Direct wallet connected successfully: ${address}`);
      }
    } catch (error) {
      addLog('error', 'Failed to connect direct wallet', error);
    }
  }, [addLog]);

  const handleConnectXmtp = useCallback(async () => {
    if (!isWalletConnected) {
      addLog('error', 'Please connect your wallet first.');
      return;
    }
    addLog('system', '--- Starting XMTP Connection ---');
    try {
      await connectXmtp();
      addLog('success', '--- XMTP Connection Succeeded ---');
    } catch (error: any) {
      addLog('error', '--- XMTP Connection Failed ---', { message: error.message, stack: error.stack });
    }
  }, [connectXmtp, addLog, isWalletConnected]);
  
  const handleDisconnectXmtp = useCallback(() => {
    disconnectXmtp();
    addLog('system', 'XMTP Disconnected');
  }, [disconnectXmtp, addLog]);

  const handleSendMessage = useCallback(async () => {
    if (!testAddress || !testMessage) {
      addLog('warn', 'Please enter both address and message');
      return;
    }

    try {
      setIsLoading(true);
      addLog('info', `Sending message to ${testAddress}: "${testMessage}"`);
      await sendMessage(testAddress, testMessage);
      addLog('success', 'Message sent successfully');
    } catch (error) {
      addLog('error', 'Failed to send message', error);
    } finally {
      setIsLoading(false);
    }
  }, [testAddress, testMessage, sendMessage, addLog]);

  const handleWarmupConversation = useCallback(async () => {
    if (!testAddress) {
      addLog('warn', 'Please enter recipient address');
      return;
    }

    try {
      setIsLoading(true);
      addLog('info', `🔥 Starting XMTP warmup for ${testAddress}...`);
      
      const result = await warmupConversation(testAddress);
      addLog('success', '✅ XMTP warmup completed successfully!', result);
    } catch (error) {
      addLog('error', '❌ XMTP warmup failed', error);
    } finally {
      setIsLoading(false);
    }
  }, [testAddress, warmupConversation, addLog]);

  const handleGetHistory = useCallback(async () => {
    if (!walletAddress) {
      addLog('warn', 'Wallet not connected');
      return;
    }

    try {
      setIsLoading(true);
      addLog('info', 'Fetching conversation history...');
      
      const history = await getConversationHistory();
      addLog('success', `Found ${history.length} messages`, history);
    } catch (error) {
      addLog('error', 'Failed to fetch history', error);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, getConversationHistory, addLog]);

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };
  
  const DiagnosticItem: React.FC<{ title: string; result: DiagnosticResult }> = ({ title, result }) => (
    <div className="flex justify-between items-center text-sm">
      <span>{title}:</span>
      <span className={getStatusColor(result.status)} title={result.message}>
        {result.status.toUpperCase()}
      </span>
    </div>
  );

  // Test wagmi signature function
  const testWagmiSignature = async () => {
    try {
      if (!isWagmiConnected || !wagmiAddress || !walletClient) {
        addLog('warn', 'Wagmi wallet not connected or walletClient not available');
        return;
      }

      addLog('info', '🧪 [Wagmi] Testing wagmi signature process...');
      
      // Create wagmi-based signer similar to XmtpContext
      const wagmiSigner = {
        type: 'EOA' as const,
        
        getIdentity() {
          return {
            kind: 'ETHEREUM' as const,
            identifier: wagmiAddress.toLowerCase(),
          };
        },
        
        getIdentifier() {
          return {
            identifier: wagmiAddress.toLowerCase(),
            identifierKind: 'Ethereum' as const
          };
        },
        
        async signMessage(message: string | Uint8Array) {
          addLog('info', '📝 [Wagmi] Starting signature with wagmi...', {
            messageType: typeof message,
            messageLength: message instanceof Uint8Array ? message.length : message.length,
            isUint8Array: message instanceof Uint8Array
          });
          
          const messageToSign: SignableMessage = typeof message === 'string' 
            ? message 
            : { raw: message };
          
          const signature = await walletClient.signMessage({ 
            account: walletClient.account!, 
            message: messageToSign 
          });
          
          addLog('success', '✅ [Wagmi] Raw signature received', {
            signatureLength: signature.length,
            signatureType: typeof signature,
            signatureStart: signature.substring(0, 10),
            signatureEnd: signature.substring(signature.length - 10),
            fullSignature: signature
          });
          
          // Use the same conversion logic as XmtpContext
          if (signature.length === 132) {
            const hex = signature.startsWith('0x') ? signature.slice(2) : signature;
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) {
              bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
            }
            
            addLog('success', '🔄 [Wagmi] Converted to Uint8Array', {
              originalHexLength: hex.length,
              uint8ArrayLength: bytes.length,
              expectedLength: bytes.length === 65 ? 'correct (65 bytes)' : `unexpected (${bytes.length} bytes)`,
              firstBytes: Array.from(bytes.slice(0, 10)),
              lastBytes: Array.from(bytes.slice(-5))
            });
            
            return bytes;
          } else if (signature.length > 132) {
            // Handle Coinbase Smart Wallet long format (same as XmtpContext)
            addLog('warn', '⚠️ [Wagmi] Attempting to extract standard signature from long format...');
            
            const hex = signature.startsWith('0x') ? signature.slice(2) : signature;
            let extractedHex = '';
            
            // Strategy 1: Look for the last 130 hex characters (65 bytes)
            if (hex.length >= 130) {
              extractedHex = hex.slice(-130);
            }
            
            // Strategy 2: If that doesn't work, try to find a valid signature pattern
            if (!extractedHex && hex.length > 130) {
              const patterns = [
                /([0-9a-f]{130})$/i,  // Last 130 hex chars
                /([0-9a-f]{130})[0-9a-f]*$/i,  // 130 hex chars followed by anything
                /^[0-9a-f]*?([0-9a-f]{130})[0-9a-f]*$/i  // 130 hex chars anywhere
              ];
              
              for (const pattern of patterns) {
                const match = hex.match(pattern);
                if (match && match[1]) {
                  extractedHex = match[1];
                  addLog('info', '🎯 [Wagmi] Found signature using pattern: ' + pattern.source);
                  break;
                }
              }
            }
            
            // Strategy 3: If still no luck, try extracting from middle section
            if (!extractedHex && hex.length > 260) {
              const start = Math.floor((hex.length - 130) / 2);
              extractedHex = hex.slice(start, start + 130);
              addLog('info', '🔍 [Wagmi] Trying middle extraction from position: ' + start);
            }
            
            if (extractedHex && extractedHex.length === 130) {
              const bytes = new Uint8Array(65);
              for (let i = 0; i < 130; i += 2) {
                bytes[i / 2] = parseInt(extractedHex.substr(i, 2), 16);
              }
              
              addLog('success', '🔄 [Wagmi] Extracted standard signature from long format', {
                originalLength: hex.length,
                extractedLength: extractedHex.length,
                uint8ArrayLength: bytes.length,
                firstBytes: Array.from(bytes.slice(0, 10)),
                lastBytes: Array.from(bytes.slice(-5)),
                extractionStrategy: 'smart-wallet-compatible'
              });
              
              return bytes;
            } else {
              addLog('error', '❌ [Wagmi] Failed to extract valid signature from long format', {
                originalLength: hex.length,
                extractedLength: extractedHex.length
              });
              throw new Error(`Failed to extract signature from long format: ${hex.length} chars`);
            }
          } else {
            addLog('error', '❌ [Wagmi] Unexpected signature format', {
              signatureLength: signature.length,
              expectedLength: 132
            });
            throw new Error(`Invalid signature format: length ${signature.length}`);
          }
        }
      };

      // Test signing a simple message
      const testMessage = 'XMTP wagmi signature test';
      addLog('info', `🧪 [Wagmi] Testing signature with message: "${testMessage}"`);
      
      const testSignature = await wagmiSigner.signMessage(testMessage);
      addLog('success', `✅ [Wagmi] Test signature successful!`, {
        signatureLength: testSignature.length,
        isUint8Array: testSignature instanceof Uint8Array
      });

    } catch (error: any) {
      addLog('error', `❌ [Wagmi] Signature test failed: ${error.message}`, error);
      console.error('Wagmi signature test error:', error);
    }
  };

  const testDirectXmtpClient = async () => {
    try {
      if (!isWalletConnected || !walletAddress) {
        addLog('warn', 'Wallet not connected');
        return;
      }

      addLog('info', 'Testing direct XMTP client creation (main thread)...');
      
      const { Client } = await import('@xmtp/browser-sdk');
      
      if (!window.ethereum) {
        addLog('error', 'No ethereum provider found');
        return;
      }

      // Create a simple signer similar to RemoteSigner but in main thread
      const directSigner = {
        type: 'EOA' as const,
        
        async getAddress() {
          return walletAddress;
        },
        
        getIdentity() {
          return {
            kind: 'ETHEREUM' as const,
            identifier: walletAddress.toLowerCase(),
          };
        },
        
        getIdentifier() {
          return {
            identifier: walletAddress.toLowerCase(),
            identifierKind: 'Ethereum' as const
          };
        },
        
        async signMessage(message: string | Uint8Array) {
          try {
            addLog('info', '📝 [Direct] Starting signature process...', {
              messageType: typeof message,
              messageLength: message instanceof Uint8Array ? message.length : message.length,
              isUint8Array: message instanceof Uint8Array,
              walletAddress: walletAddress
            });
            
            let messageToSign: string;
            if (message instanceof Uint8Array) {
              // Convert Uint8Array to hex string for signing
              messageToSign = '0x' + Array.from(message).map(b => b.toString(16).padStart(2, '0')).join('');
              addLog('info', '🔄 [Direct] Converted Uint8Array to hex for signing', {
                originalLength: message.length,
                hexLength: messageToSign.length,
                hexPreview: messageToSign.substring(0, 20) + '...'
              });
            } else {
              messageToSign = message;
              addLog('info', '📄 [Direct] Using string message as-is', {
                messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : '')
              });
            }
            
            addLog('info', '🔐 [Direct] Requesting signature via personal_sign...', {
              method: 'personal_sign',
              messageToSign: messageToSign.substring(0, 50) + (messageToSign.length > 50 ? '...' : ''),
              walletAddress: walletAddress
            });
            
            const signature = await window.ethereum.request({
              method: 'personal_sign',
              params: [messageToSign, walletAddress]
            });
            
            addLog('success', '✅ [Direct] Raw signature received from wallet', {
              signatureLength: signature.length,
              signatureType: typeof signature,
              signatureStart: signature.substring(0, 10),
              signatureEnd: signature.substring(signature.length - 10),
              hasPrefix: signature.startsWith('0x')
            });
            
            // Convert hex signature to Uint8Array using the SAME method as XmtpContext
            const hex = signature.startsWith('0x') ? signature.slice(2) : signature;
            
            // Use the same conversion method as in XmtpContext
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) {
              bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
            }
            
            addLog('success', '🔄 [Direct] Converted hex to Uint8Array (same method as XmtpContext)', {
              originalHexLength: hex.length,
              uint8ArrayLength: bytes.length,
              expectedLength: bytes.length === 65 ? 'correct (65 bytes)' : `unexpected (${bytes.length} bytes)`,
              firstBytes: Array.from(bytes.slice(0, 10)),
              lastBytes: Array.from(bytes.slice(-5)),
              conversionMethod: 'for-loop with parseInt(hex.substr(i, 2), 16)'
            });
            
            return bytes;
          } catch (signError) {
            addLog('error', '❌ [Direct] Signing failed', signError);
            throw signError;
          }
        }
      };

      addLog('success', `Direct signer created: ${JSON.stringify({
        type: directSigner.type,
        identifier: directSigner.getIdentifier().identifier,
        address: await directSigner.getAddress(),
        getIdentifier: directSigner.getIdentifier()
      })}`);

      // Try Client.create (XMTP v3 method)
      addLog('info', '🚀 [Direct] Calling Client.create with direct signer...', {
        signerType: typeof directSigner,
        hasGetIdentity: typeof directSigner.getIdentity === 'function',
        hasGetIdentifier: typeof directSigner.getIdentifier === 'function',
        hasSignMessage: typeof directSigner.signMessage === 'function',
        getIdentityResult: directSigner.getIdentity(),
        getIdentifierResult: directSigner.getIdentifier()
      });
      
      const xmtpClient = await Client.create(directSigner, {
        env: 'production'
      });

      // In XMTP v3, client doesn't have getAddress() method, use walletAddress
      addLog('success', `✅ Direct XMTP client created successfully: ${walletAddress}`, {
        clientType: typeof xmtpClient,
        hasInboxId: 'inboxId' in xmtpClient,
        hasConversations: 'conversations' in xmtpClient,
        inboxId: (xmtpClient as any).inboxId || 'not available'
      });
      
    } catch (error: any) {
      addLog('error', `❌ Direct XMTP client failed: ${error.message}`);
      console.error('Direct XMTP test error:', error);
    }
  };

  const handleDebugClient = useCallback(async () => {
    if (!xmtpConnected) {
      addLog('warn', 'XMTP not connected');
      return;
    }

    try {
      setIsLoading(true);
      addLog('info', 'Debugging XMTP client...');
      
      // Call debugClient via worker API
      const debugInfo = await new Promise((resolve, reject) => {
        const id = Date.now();
        const timeoutId = setTimeout(() => reject(new Error('Timeout')), 10000);
        
        const handleMessage = (event: MessageEvent) => {
          if (event.data.id === id) {
            clearTimeout(timeoutId);
            window.removeEventListener('message', handleMessage);
            if (event.data.success) {
              resolve(event.data.payload);
            } else {
              reject(new Error(event.data.error?.message || 'Unknown error'));
            }
          }
        };
        
        window.addEventListener('message', handleMessage);
        
        // Send message to worker
        const worker = (window as any).xmtpWorker;
        if (worker) {
          worker.postMessage({ id, action: 'debugClient', payload: {} });
        } else {
          clearTimeout(timeoutId);
          window.removeEventListener('message', handleMessage);
          reject(new Error('Worker not available'));
        }
      });
      
      addLog('success', 'XMTP Client Debug Info', debugInfo);
    } catch (error) {
      addLog('error', 'Failed to debug client', error);
    } finally {
      setIsLoading(false);
    }
  }, [xmtpConnected, addLog]);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-mono">
      <div className="container mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-purple-400">XMTP Advanced Debugger</h1>
          <p className="text-gray-400">V3 Integration Diagnostics</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Panel: Controls & Diagnostics */}
          <div className="md:col-span-1 space-y-6">
            
            {/* Diagnostics Panel */}
            <div className="bg-gray-800 rounded-lg p-4 border border-purple-500/30">
              <h2 className="text-lg font-semibold mb-3 text-purple-300 border-b border-purple-500/20 pb-2">Diagnostics</h2>
              <div className="space-y-2">
                <DiagnosticItem title="SES Bypass" result={diagnostics.sesBypass} />
                <DiagnosticItem title="MetaMask Wallet" result={diagnostics.metaMask} />
                <DiagnosticItem title="Snap Support" result={diagnostics.snapSupport} />
              </div>
            </div>

            {/* Connection Panel */}
            <div className="bg-gray-800 rounded-lg p-4 border border-purple-500/30">
              <h2 className="text-lg font-semibold mb-3 text-purple-300 border-b border-purple-500/20 pb-2">Connection</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Wagmi Wallet:</span>
                  <span className={isWagmiConnected ? 'text-green-400' : 'text-red-400'}>
                    {isWagmiConnected ? `Connected (${wagmiAddress?.substring(0, 6)}...${wagmiAddress?.substring(wagmiAddress.length - 4)})` : 'Disconnected'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Direct Wallet:</span>
                  <span className={isWalletConnected ? 'text-green-400' : 'text-red-400'}>
                    {isWalletConnected ? `Connected (${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)})` : 'Disconnected'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>XMTP Client:</span>
                  <span className={xmtpConnected ? 'text-green-400' : xmtpConnecting ? 'text-yellow-400' : 'text-red-400'}>
                    {xmtpConnected ? 'Connected' : xmtpConnecting ? 'Connecting...' : 'Disconnected'}
                  </span>
                </div>
                
                {/* Wagmi Connection Buttons */}
                <div className="border-t border-gray-700 pt-2">
                  <div className="text-xs text-gray-400 mb-2">Wagmi Connection:</div>
                  {!isWagmiConnected ? (
                    <button onClick={handleConnectWagmi} className="w-full bg-blue-600 hover:bg-blue-700 rounded-md py-2 transition-colors text-sm">Connect Wagmi Wallet</button>
                  ) : (
                    <button onClick={handleDisconnectWagmi} className="w-full bg-red-600 hover:bg-red-700 rounded-md py-2 transition-colors text-sm">Disconnect Wagmi</button>
                  )}
                </div>
                
                {/* Direct Connection Buttons */}
                <div className="border-t border-gray-700 pt-2">
                  <div className="text-xs text-gray-400 mb-2">Direct Connection:</div>
                  {!isWalletConnected ? (
                    <button onClick={handleConnectWallet} className="w-full bg-green-600 hover:bg-green-700 rounded-md py-2 transition-colors text-sm">Connect Direct Wallet</button>
                  ) : (
                    <div className="text-xs text-green-400">Direct wallet connected</div>
                  )}
                </div>
                
                {/* XMTP Connection */}
                <div className="border-t border-gray-700 pt-2">
                  <div className="text-xs text-gray-400 mb-2">XMTP Connection:</div>
                  {!xmtpConnected ? (
                    <button onClick={handleConnectXmtp} disabled={xmtpConnecting || (!isWagmiConnected && !isWalletConnected)} className="w-full bg-purple-600 hover:bg-purple-700 rounded-md py-2 transition-colors disabled:bg-gray-500 text-sm">Connect XMTP</button>
                  ) : (
                    <button onClick={handleDisconnectXmtp} className="w-full bg-red-600 hover:bg-red-700 rounded-md py-2 transition-colors text-sm">Disconnect XMTP</button>
                  )}
                </div>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="bg-gray-800 rounded-lg p-4 border border-purple-500/30">
              <h2 className="text-lg font-semibold mb-3 text-purple-300 border-b border-purple-500/20 pb-2">Actions</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400">Peer Address</label>
                  <input type="text" value={testAddress} onChange={e => setTestAddress(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Message</label>
                  <input type="text" value={testMessage} onChange={e => setTestMessage(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm mt-1" />
                </div>
                <div className="space-y-2">
                  <button 
                    onClick={handleWarmupConversation} 
                    disabled={!xmtpConnected || isLoading || !testAddress} 
                    className="w-full bg-yellow-600 hover:bg-yellow-700 rounded-md py-2 transition-colors disabled:bg-gray-500 text-sm"
                  >
                    🔥 Prepare XMTP
                  </button>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <button onClick={handleSendMessage} disabled={!xmtpConnected || isLoading} className="bg-green-600 hover:bg-green-700 rounded-md py-2 transition-colors disabled:bg-gray-500">Send Message</button>
                    <button onClick={handleGetHistory} disabled={!xmtpConnected || isLoading} className="bg-blue-600 hover:bg-blue-700 rounded-md py-2 transition-colors disabled:bg-gray-500">Get History</button>
                  </div>
                </div>
                <div className="border-t border-gray-700 pt-3 space-y-2">
                  <button onClick={testWagmiSignature} disabled={!isWagmiConnected || isLoading} className="w-full bg-blue-600 hover:bg-blue-700 rounded-md py-2 transition-colors disabled:bg-gray-500 text-sm">
                    🧪 Test Wagmi Signature
                  </button>
                  <button onClick={testDirectXmtpClient} disabled={!isWalletConnected || isLoading} className="w-full bg-orange-600 hover:bg-orange-700 rounded-md py-2 transition-colors disabled:bg-gray-500 text-sm">
                    🧪 Test Direct XMTP (Main Thread)
                  </button>
                </div>
                <div className="border-t border-gray-700 pt-3">
                  <button onClick={handleDebugClient} disabled={!xmtpConnected || isLoading} className="w-full bg-purple-600 hover:bg-purple-700 rounded-md py-2 transition-colors disabled:bg-gray-500 text-sm">
                    🧪 Debug XMTP Client
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Logs */}
          <div className="md:col-span-2 bg-black/50 rounded-lg p-4 border border-purple-500/30 flex flex-col h-[80vh]">
             <div className="flex justify-between items-center mb-2 border-b border-purple-500/20 pb-2">
                <h2 className="text-lg font-semibold text-purple-300">Live Logs</h2>
                <button onClick={clearLogs} className="text-xs bg-gray-700 hover:bg-red-800 px-2 py-1 rounded-md transition-colors">Clear</button>
             </div>
            <div className="flex-grow overflow-y-auto pr-2 space-y-2 text-sm">
              {logs.map((log, index) => (
                <div key={index} className="flex">
                  <span className="text-gray-500 mr-2">{log.timestamp}</span>
                  <span className={`mr-2 font-bold ${
                    log.level === 'error' ? 'text-red-500' :
                    log.level === 'warn' ? 'text-yellow-500' :
                    log.level === 'success' ? 'text-green-500' :
                    log.level === 'system' ? 'text-purple-400' :
                    'text-blue-400'
                  }`}>
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className="flex-1 whitespace-pre-wrap">{log.message}</span>
                  {log.data && (
                    <pre className="text-xs bg-gray-800 p-2 rounded-md mt-1 w-full overflow-x-auto">
                      {JSON.stringify(log.data, (_key, value) => {
                        // Handle BigInt values
                        return typeof value === 'bigint' ? value.toString() : value;
                      }, 2)}
                    </pre>
                  )}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default XmtpDebugPage; 