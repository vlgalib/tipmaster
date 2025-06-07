import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
}

const AlertModal: React.FC<AlertModalProps> = ({ isOpen, onClose, title, message }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-card rounded-xl border border-border p-6 w-full max-w-md shadow-2xl animate-in fade-in-0 zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-error" />
          </div>
          <div className="flex-grow">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full -mr-2 -mt-2"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-muted-foreground">
              {message}
            </p>
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-all duration-200"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal; 