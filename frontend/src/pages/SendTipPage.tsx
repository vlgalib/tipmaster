import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, User, Search } from 'lucide-react';

const SendTipPage: React.FC = () => {
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const validateAddress = (addr: string): boolean => {
    // Check if it's a valid Ethereum address (0x followed by 40 hex characters)
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    // Check if it's a basename (ends with .base.eth)
    const basenameRegex = /^[a-zA-Z0-9-]+\.base\.eth$/;
    
    return ethAddressRegex.test(addr) || basenameRegex.test(addr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      alert('Please enter a wallet address or basename');
      return;
    }

    setIsValidating(true);
    
    try {
      let finalAddress = address.trim();
      
      // If it's a basename, we would normally resolve it to an address
      // For now, we'll just check if it's valid format
      if (address.endsWith('.base.eth')) {
        // In a real app, you would resolve the basename to an address here
        // For demo purposes, we'll show an alert
        alert('Basename resolution not implemented yet. Please use a wallet address (0x...)');
        setIsValidating(false);
        return;
      }
      
      if (!validateAddress(finalAddress)) {
        alert('Please enter a valid wallet address (0x...) or basename (.base.eth)');
        setIsValidating(false);
        return;
      }
      
      // Navigate to the tip page with the address
      navigate(`/tip/${finalAddress}`);
    } catch (error) {
      console.error('Error validating address:', error);
      alert('Error validating address. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 py-4">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Home</span>
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4">
        {/* Header Section */}
        <div className="text-center mb-8 mt-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Send a Tip</h1>
          <p className="text-muted-foreground text-lg">
            Enter the recipient's wallet address or basename to send them a tip
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="address" className="block text-lg font-semibold text-foreground mb-3">
                Recipient Address
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x... or username.base.eth"
                  className="w-full pl-12 pr-4 py-4 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm font-mono"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Enter a wallet address (0x...) or a basename (username.base.eth)
              </p>
            </div>

            <button
              type="submit"
              disabled={isValidating || !address.trim()}
              className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold rounded-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isValidating ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                  Validating...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Continue to Tip
                </>
              )}
            </button>
          </form>
        </div>

        {/* Examples Section */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Examples</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <User size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Wallet Address</p>
                <p className="text-xs text-muted-foreground font-mono">0x742d35Cc6634C0532925a3b8D...</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <User size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Basename</p>
                <p className="text-xs text-muted-foreground">alice.base.eth</p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 p-4 bg-muted/50 border border-border rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            🔒 Always double-check the recipient address before sending. 
            Transactions cannot be reversed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SendTipPage; 