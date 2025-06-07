import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Home, Send } from 'lucide-react';

const StaffNotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const staffId = searchParams.get('staffId');

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
        {/* Error Content */}
        <div className="text-center mt-16 mb-8">
          <div className="w-20 h-20 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-error" />
          </div>
          
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Staff Member Not Found
          </h1>
          
          <p className="text-muted-foreground text-lg mb-2">
            We couldn't find a staff member with this address.
          </p>
          
          {staffId && (
            <div className="bg-muted rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground mb-2">Searched for:</p>
              <p className="text-sm font-mono text-foreground break-all">
                {staffId}
              </p>
            </div>
          )}
        </div>

        {/* Suggestions Card */}
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">What you can do:</h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-primary font-bold text-sm">1</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Double-check the address
                </p>
                <p className="text-xs text-muted-foreground">
                  Make sure you have the correct wallet address or QR code
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-primary font-bold text-sm">2</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Ask the staff member to register
                </p>
                <p className="text-xs text-muted-foreground">
                  They need to create a profile on TipMaster first
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-primary font-bold text-sm">3</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Try entering the address manually
                </p>
                <p className="text-xs text-muted-foreground">
                  Use our address input feature to send tips directly
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/send-tip')}
            className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Send size={18} />
            Enter Address Manually
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="w-full py-4 px-6 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Home size={18} />
            Back to Home
          </button>
        </div>

        {/* Help Section */}
        <div className="mt-8 p-4 bg-muted/50 border border-border rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            💡 <strong>Tip:</strong> Staff members need to register on TipMaster before they can receive tips. 
            If you're a staff member, click "I'm Staff - Get Started" on the home page.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StaffNotFoundPage; 