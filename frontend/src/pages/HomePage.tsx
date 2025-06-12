import React, { useState } from 'react';
import { ChevronDown, Mail, Wallet, Building, CreditCard, Shield, Users, Zap, Clock, TrendingUp, MessageSquare, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';

const FaqItem = ({ question, answer }: { question: string, answer: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-700 py-4">
      <button
        className="w-full flex justify-between items-center text-left text-lg font-semibold text-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{question}</span>
        <ChevronDown className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="mt-4 text-gray-300 pr-8">{answer}</div>}
    </div>
  );
};

const RoadmapItem = ({ 
  icon: Icon, 
  title, 
  description, 
  status, 
}: { 
  icon: any; 
  title: string; 
  description: string; 
  status: 'coming-soon' | 'in-development' | 'new';
}) => {
  return (
    <div className="relative flex flex-col">
      <div className="flex-grow bg-gray-800 rounded-2xl p-8 hover:bg-gray-750 transition-all duration-300 transform hover:scale-105 z-10">
        <div className="flex flex-col items-center text-center h-full">
          <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center mb-4">
            <Icon size={32} className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
          <p className="text-gray-300 text-sm leading-relaxed mb-4 flex-grow">{description}</p>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
            status === 'coming-soon' 
              ? 'bg-yellow-500/20 text-yellow-400' 
              : status === 'in-development'
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-green-500/20 text-green-400'
          }`}>
            {status === 'coming-soon' ? 'Coming Soon' : status === 'in-development' ? 'In Development' : 'New'}
          </div>
        </div>
      </div>
    </div>
  );
};

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <main className="container mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold leading-tight mb-4">
          Tips Made Simple, Crypto Made Easy
        </h1>
        <p className="text-xl text-gray-400 mb-10">
          The future of tipping is here. Powered by crypto.
        </p>
        <div className="flex justify-center space-x-4">
          <Link
            to="/auth"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-full transition duration-300"
          >
            I'm Staff - Get Started
          </Link>
          <Link
            to="/send-tip"
            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-full transition duration-300"
          >
            I'm a Customer - Send Tips
          </Link>
        </div>
      </main>

      <section id="faq" className="container mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
        <div className="max-w-3xl mx-auto">
          <FaqItem
            question="Why do we need crypto tips?"
            answer={
              <p>
                Every country has different rules for tip payments and tip taxes, so we're creating a platform that makes receiving tips simple and convenient for everyone, regardless of future legal regulations. Crypto tips provide transparency, instant transfers, and global accessibility without traditional banking limitations.
              </p>
            }
          />
          <FaqItem
            question="How to scan a QR and send tips?"
            answer={
              <p>
                Simply open your phone's camera, point it at the QR code, and tap the link that appears. This will take you to the staff member's tipping page. From there, you can connect your wallet, enter an amount, and send your tip!
              </p>
            }
          />
          <FaqItem
            question="Which wallets are supported?"
            answer={
              <p>
                We support a wide range of wallets, including Coinbase Wallet, MetaMask, and most mobile wallets that use WalletConnect. For the best experience, we recommend using Coinbase Wallet.
              </p>
            }
          />
          <FaqItem
            question="What is USDC and the Base network?"
            answer={
              <p>
                USDC is a stablecoin, which is a type of cryptocurrency pegged to a stable asset like the U.S. dollar. This means 1 USDC is always worth approximately $1. Base is a fast, low-cost, and secure blockchain developed by Coinbase, making it perfect for small transactions like tips.
              </p>
            }
          />
          <FaqItem
            question="I have a problem with my payment."
            answer={
              <p>
                Please ensure you have enough ETH on the Base network to cover the small network fee (gas). Also, check that you have sufficient USDC for the tip itself. If problems persist, please try again after a few minutes.
              </p>
            }
          />
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">What's Coming Next</h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            We're constantly innovating to make tipping more accessible, secure, and convenient for everyone.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <RoadmapItem
            icon={Mail}
            title="Gmail Authentication"
            description="Sign in with your Google account and we'll automatically generate a secure crypto wallet for you."
            status="coming-soon"
          />
          
          <RoadmapItem
            icon={Wallet}
            title="Wallet Management"
            description="Withdraw your tips to any address and manage your crypto assets with ease."
            status="coming-soon"
          />
          
          <RoadmapItem
            icon={Building}
            title="Restaurant Accounts"
            description="Comprehensive restaurant management with branded QR codes, staff reports, and automatic tip distribution."
            status="in-development"
          />
          
          <RoadmapItem
            icon={CreditCard}
            title="Card Payments"
            description="Accept traditional credit card payments alongside crypto, making it easier for all customers."
            status="coming-soon"
          />
          <RoadmapItem
            icon={Users}
            title="Group Tipping"
            description="Allow multiple customers to contribute to a single tip pool for a staff member or an entire team."
            status="new"
          />
          <RoadmapItem
            icon={Zap}
            title="Staff Internal-Chat"
            description="A dedicated chat for restaurant employees to communicate and coordinate effectively within the app."
            status="new"
          />
          
          <RoadmapItem
            icon={MessageSquare}
            title="AI Thank You Messages"
            description="Send personalized thank you messages for each tip or bulk responses, with AI-generated content based on tip amounts."
            status="new"
          />
          
          <RoadmapItem
            icon={TrendingUp}
            title="Smart Tip Recommendations"
            description="Suggest average tip amounts based on user's history or restaurant averages, plus country-specific tipping norms."
            status="new"
          />
          
          <RoadmapItem
            icon={Coins}
            title="Multi-Crypto & Staking"
            description="Accept payments in any crypto from any network with auto-conversion, plus built-in tip staking features."
            status="new"
          />
        </div>

        {/* Stats Section */}
        <div className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          <div className="flex flex-col items-center">
            <Shield className="w-8 h-8 text-indigo-400 mb-2" />
            <div className="text-2xl font-bold">100%</div>
            <div className="text-gray-400 text-sm">Secure</div>
          </div>
          <div className="flex flex-col items-center">
            <Zap className="w-8 h-8 text-indigo-400 mb-2" />
            <div className="text-2xl font-bold">&lt;$0.01</div>
            <div className="text-gray-400 text-sm">Transaction Fee</div>
          </div>
          <div className="flex flex-col items-center">
            <Clock className="w-8 h-8 text-indigo-400 mb-2" />
            <div className="text-2xl font-bold">&lt;5s</div>
            <div className="text-gray-400 text-sm">Settlement Time</div>
          </div>
          <div className="flex flex-col items-center">
            <Users className="w-8 h-8 text-indigo-400 mb-2" />
            <div className="text-2xl font-bold">24/7</div>
            <div className="text-gray-400 text-sm">Available</div>
          </div>
        </div>
      </section>

      <footer className="text-center py-10 text-gray-500">
        <p>&copy; 2025 TipMaster. All Rights Reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage; 