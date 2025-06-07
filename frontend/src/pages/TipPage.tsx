import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useDisconnect,
} from 'wagmi';
import { parseUnits } from 'viem';
import { base } from 'wagmi/chains';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import { Address } from '@coinbase/onchainkit/identity';
import { ArrowLeft, Send, Wallet, QrCode, Star, LogOut, AlertCircle, X } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { getStaff, sendTip } from '../services/api';
import AlertModal from '../components/AlertModal';

// USDC contract address on Base
const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const TipPage: React.FC = () => {
  const { staffId } = useParams<{ staffId: string }>();
  const navigate = useNavigate();
  const { address, isConnected, chainId } = useAccount();
  const { data: hash, writeContract, error: contractError } = useWriteContract();
  const { switchChain } = useSwitchChain();
  const { disconnect } = useDisconnect();

  const [staff, setStaff] = useState<{ name: string; photoUrl: string } | null>(null);
  const [amount, setAmount] = useState(5);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'connect' | 'qr'>('connect');
  const [alertInfo, setAlertInfo] = useState<{ show: boolean, title: string, message: string }>({ 
    show: false, 
    title: '', 
    message: '' 
  });

  useEffect(() => {
    if (staffId) {
      getStaff(staffId).then(setStaff).catch(err => {
        console.error(err);
        navigate(`/staff-not-found?staffId=${encodeURIComponent(staffId)}`);
      });
    }
  }, [staffId, navigate]);
  
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } = 
    useWaitForTransactionReceipt({ 
      hash, 
    })

  // Handle contract write errors
  useEffect(() => {
    if (contractError) {
      console.error("Contract write error:", contractError);
      let errorMessage = "Transaction failed. Please try again.";
      
      if (contractError.message.includes('insufficient funds')) {
        errorMessage = "Insufficient funds. Please check your USDC balance.";
      } else if (contractError.message.includes('user rejected')) {
        errorMessage = "Transaction was cancelled by user.";
      } else if (contractError.message.includes('network')) {
        errorMessage = "Network error. Please check your connection.";
      }
      
      setAlertInfo({
        show: true,
        title: "Transaction Failed",
        message: errorMessage
      });
    }
  }, [contractError]);

  // Handle transaction receipt errors
  useEffect(() => {
    if (receiptError) {
      console.error("Transaction receipt error:", receiptError);
      setAlertInfo({
        show: true,
        title: "Transaction Failed",
        message: "Transaction was not successful. Please try again."
      });
    }
  }, [receiptError]);

  const handleSendTip = async () => {
      if (!staffId || !address || (amount <= 0 && !customAmount) ) return;
      
      const tipAmount = customAmount ? parseFloat(customAmount) : amount;
      
      // Validate amount
      if (tipAmount <= 0 || tipAmount > 10000) {
        setAlertInfo({
          show: true,
          title: "Invalid Amount",
          message: "Please enter a valid amount between $0.01 and $10,000."
        });
        return;
      }
      
      try {
        // Check if we're on Base network, if not switch to it
        if (chainId !== base.id) {
          await switchChain({ chainId: base.id });
          return; // Exit here, user will need to click again after network switch
        }
        
        // Send USDC on Base network
        await writeContract({
          address: USDC_CONTRACT_ADDRESS,
          abi: USDC_ABI,
          functionName: 'transfer',
          args: [staffId as `0x${string}`, parseUnits(tipAmount.toString(), 6)], // USDC has 6 decimals
        });
      } catch (error) {
        console.error("USDC transaction failed", error);
        let errorMessage = "Transaction failed. Please try again.";
        
        if (error instanceof Error) {
          if (error.message.includes('insufficient funds')) {
            errorMessage = "Insufficient USDC balance. Please add more USDC to your wallet.";
          } else if (error.message.includes('user rejected')) {
            errorMessage = "Transaction was cancelled.";
          } else if (error.message.includes('network')) {
            errorMessage = "Network error. Please check your connection and try again.";
          }
        }
        
        setAlertInfo({
          show: true,
          title: "Transaction Error",
          message: errorMessage
        });
      }
  }

  // Effect to run after transaction is confirmed
  useEffect(() => {
    if (isConfirmed && hash && staffId && address) {
        const tipAmount = customAmount ? parseFloat(customAmount) : amount;
        // Save tip to our backend
        sendTip({
            staffId,
            amount: tipAmount,
            message,
            senderAddress: address,
            txHash: hash,
        })
        .then(() => {
            navigate(`/payment/success?amount=${tipAmount}&staffId=${staffId}&txHash=${hash}`);
        })
        .catch(err => {
            console.error("Failed to save tip to backend", err);
            // Even if backend fails, the user has sent the money. Show success but log error.
             navigate(`/payment/success?amount=${tipAmount}&staffId=${staffId}&txHash=${hash}&error=backend`);
        });
    }
  }, [isConfirmed, hash, staffId, address, amount, customAmount, message, navigate]);

  if (!staff) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading staff information...</p>
        </div>
      </div>
    );
  }
  
  const tipUri = `ethereum:${USDC_CONTRACT_ADDRESS}/transfer?address=${staffId}&uint256=${(Number(customAmount) || amount) * 1e6}`;
  const isLoading = isConfirming;
  const selectedAmount = customAmount ? parseFloat(customAmount) : amount;

  return (
    <>
      <AlertModal 
        isOpen={alertInfo.show}
        onClose={() => setAlertInfo({ show: false, title: '', message: '' })}
        title={alertInfo.title}
        message={alertInfo.message}
      />
      <div className="min-h-screen bg-background">
        {/* Error Banner */}
        {(contractError || receiptError) && (
          <div className="bg-error/10 border-b border-error/20">
            <div className="max-w-md mx-auto px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-error">
                  <AlertCircle size={16} />
                  <span className="text-sm font-medium">Transaction Failed</span>
                </div>
                <button
                  onClick={() => {
                    setAlertInfo({ show: false, title: '', message: '' });
                  }}
                  className="text-error hover:text-error/80 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-card border-b border-border">
          <div className="max-w-md mx-auto px-4 py-4">
            <button 
              onClick={() => navigate('/')} 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
          </div>
        </div>

        <div className="max-w-md mx-auto p-4">
          {/* Staff Profile Card */}
          <div className="bg-card rounded-xl border border-border p-6 mb-6 text-center">
            <div className="relative inline-block mb-4">
              <img 
                src={staff.photoUrl} 
                alt={staff.name} 
                className="w-20 h-20 rounded-full border-4 border-border object-cover"
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-success rounded-full border-2 border-card flex items-center justify-center">
                <Star size={12} className="text-success-foreground" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Send tip to {staff.name}</h1>
            <p className="text-sm text-muted-foreground font-mono break-all bg-muted px-3 py-1 rounded-md">
              {staffId}
            </p>
          </div>

          {/* Amount Selection */}
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Choose Amount</h2>
            
            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[5, 10, 20].map(val => (
                <button 
                  key={val} 
                  onClick={() => { setAmount(val); setCustomAmount('')}} 
                  className={`py-3 px-4 rounded-lg font-medium transition-all ${
                    amount === val && !customAmount 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-foreground hover:bg-muted/80'
                  }`}
                >
                  ${val}
                </button>
              ))}
            </div>

            {/* Custom Amount */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                $
              </div>
              <input 
                type="number"
                value={customAmount}
                onChange={e => {setCustomAmount(e.target.value); setAmount(0)}}
                placeholder="Custom amount"
                className="w-full pl-8 pr-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
              />
            </div>

            {/* Amount Display */}
            {selectedAmount > 0 && (
              <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">You're sending</p>
                  <p className="text-2xl font-bold text-primary">${selectedAmount} USDC</p>
                </div>
              </div>
            )}
          </div>

          {/* Message */}
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <label htmlFor="message" className="block text-lg font-semibold text-foreground mb-3">
              Add a message (optional)
            </label>
            <textarea
              id="message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all resize-none"
              placeholder="Great service! Thank you 😊"
            />
          </div>

          {/* Payment Method Toggle */}
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Payment Method</h2>
            <div className="flex bg-muted rounded-lg p-1">
              <button 
                onClick={() => setPaymentMethod('connect')} 
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md font-medium transition-all ${
                  paymentMethod === 'connect' 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Wallet size={16} />
                Connect Wallet
              </button>
              <button 
                onClick={() => setPaymentMethod('qr')} 
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md font-medium transition-all ${
                  paymentMethod === 'qr' 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <QrCode size={16} />
                QR Code
              </button>
            </div>
          </div>

          {/* Payment Interface */}
          <div className="bg-card rounded-xl border border-border p-6">
            {paymentMethod === 'connect' && (
              <div className="space-y-4">
                {!isConnected ? (
                  <div className="flex justify-center">
                    <ConnectWallet />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-muted p-4 rounded-xl border border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Address address={address as `0x${string}`} />
                        </div>
                        <button
                          onClick={() => disconnect()}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-full transition-colors"
                          aria-label="Disconnect Wallet"
                        >
                          <LogOut size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Network Status */}
                    <div
                      className={`p-3 rounded-lg border ${
                        chainId === base.id
                          ? 'bg-success/10 border-success text-success'
                          : 'bg-error/10 border-error text-error'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              chainId === base.id ? 'bg-success' : 'bg-error'
                            }`}
                          ></div>
                          <span className="text-sm font-medium">
                            {chainId === base.id ? (
                              'Base Network'
                            ) : (
                              'Wrong Network'
                            )}
                          </span>
                        </div>
                        {chainId !== base.id && (
                          <button
                            onClick={() => switchChain({ chainId: base.id })}
                            className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md hover:bg-primary/90 transition-colors"
                          >
                            Switch to Base
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {selectedAmount > 0 && (
                      <button
                        onClick={handleSendTip}
                        disabled={isLoading || chainId !== base.id}
                        className="w-full py-4 px-6 bg-success hover:bg-success/90 disabled:bg-muted disabled:text-muted-foreground text-success-foreground font-semibold rounded-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-success-foreground border-t-transparent rounded-full animate-spin"></div>
                            Confirming Transaction...
                          </>
                        ) : chainId !== base.id ? (
                          <>
                            Switch to Base Network First
                          </>
                        ) : (
                          <>
                            <Send size={18} />
                            Send ${selectedAmount} USDC
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {paymentMethod === 'qr' && (
              <div className="text-center space-y-4">
                <div className="inline-block p-4 bg-white rounded-xl">
                  <QRCodeCanvas value={tipUri} size={200} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Scan with your mobile wallet</p>
                  <p className="text-xs text-muted-foreground">
                    Amount: ${selectedAmount} USDC • Network: Base
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-muted/50 border border-border rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              🔒 Your transaction is secured by blockchain technology. 
              Tips are sent directly to the recipient's wallet.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default TipPage; 