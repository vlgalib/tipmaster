import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useXmtp } from '../contexts/XmtpContext';

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
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [testAddress, setTestAddress] = useState('0x742b15b19a57Ab83A7dD93a0A72B0D1EE1b69f09');
  const [testMessage, setTestMessage] = useState('Hello from XMTP!');
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
    try {
      if (!window.ethereum) {
        addLog('warn', 'No wallet found');
        return;
      }
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        const address = accounts[0];
        setWalletAddress(address);
        setIsWalletConnected(true);
        addLog('success', `Wallet already connected: ${address}`);
      } else {
        setIsWalletConnected(false);
        addLog('info', 'Wallet not connected');
      }
    } catch (error) {
      addLog('error', 'Error checking wallet connection', error);
    }
  }, [addLog]);

  const handleConnectWallet = useCallback(async () => {
    try {
      if (!window.ethereum) {
        addLog('error', 'No wallet found. Please install MetaMask.');
        return;
      }
      addLog('info', 'Requesting wallet connection...');
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        const address = accounts[0];
        setWalletAddress(address);
        setIsWalletConnected(true);
        addLog('success', `Wallet connected successfully: ${address}`);
      }
    } catch (error) {
      addLog('error', 'Failed to connect wallet', error);
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
        identifier: walletAddress.toLowerCase(),
        
        async getAddress() {
          return walletAddress;
        },
        
        getIdentifier() {
          return walletAddress.toLowerCase();
        },
        
        async signMessage(message: string | Uint8Array) {
          try {
            let messageToSign: string;
            if (message instanceof Uint8Array) {
              // Convert Uint8Array to hex string for signing
              messageToSign = '0x' + Array.from(message).map(b => b.toString(16).padStart(2, '0')).join('');
            } else {
              messageToSign = message;
            }
            
            const signature = await window.ethereum.request({
              method: 'personal_sign',
              params: [messageToSign, walletAddress]
            });
            
            // Convert hex signature to Uint8Array
            const hex = signature.startsWith('0x') ? signature.slice(2) : signature;
            return new Uint8Array(hex.match(/.{2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
          } catch (signError) {
            addLog('error', 'Signing failed', signError);
            throw signError;
          }
        }
      };

      addLog('success', `Direct signer created: ${JSON.stringify({
        type: directSigner.type,
        identifier: directSigner.identifier,
        address: await directSigner.getAddress(),
        getIdentifier: directSigner.getIdentifier()
      })}`);

      // Try Client.build
      const xmtpClient = await (Client as any).build({ 
        signer: directSigner,
        env: 'production',
        options: {
          skipContactPublishing: true,
          useGroupsSqlStorage: false
        }
      });

      const clientAddress = await xmtpClient.getAddress();
      addLog('success', `✅ Direct XMTP client created successfully: ${clientAddress}`);
      
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
                  <span>Wallet:</span>
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
                {!isWalletConnected ? (
                  <button onClick={handleConnectWallet} className="w-full bg-blue-600 hover:bg-blue-700 rounded-md py-2 transition-colors">Connect Wallet</button>
                ) : !xmtpConnected ? (
                  <button onClick={handleConnectXmtp} disabled={xmtpConnecting} className="w-full bg-purple-600 hover:bg-purple-700 rounded-md py-2 transition-colors disabled:bg-gray-500">Connect XMTP</button>
                ) : (
                  <button onClick={handleDisconnectXmtp} className="w-full bg-red-600 hover:bg-red-700 rounded-md py-2 transition-colors">Disconnect XMTP</button>
                )}
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
                <div className="border-t border-gray-700 pt-3">
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