import { Send } from 'lucide-react';
import { WalletConnect } from './components/WalletConnect';
import { ChainSelector } from './components/ChainSelector';
import { TransferForms } from './components/TransferForms';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItMnptMCAydjJoLTJ2LTJoMnptMiAwaDJ2Mmg0djJoLTJWMzZoLTR2LTJ6bTAgMHYtMmg0djJoLTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-40"></div>

      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full filter blur-3xl animate-blob"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/20 rounded-full filter blur-3xl animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-teal-500/20 rounded-full filter blur-3xl animate-blob animation-delay-4000"></div>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-5xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-2xl mb-6 shadow-xl">
            <Send className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight">
            Multi-Chain Batch Transfer
          </h1>
          <p className="text-xl text-blue-200 max-w-2xl mx-auto">
            Send tokens to multiple recipients across Celo and Base networks in a single transaction
          </p>
        </div>

        <div className="space-y-8">
          <WalletConnect />

          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
              Select Network
            </h2>
            <ChainSelector />
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
              Transfer Tokens
            </h2>
            <TransferForms />
          </div>
        </div>

        <footer className="mt-12 text-center text-blue-300/60 text-sm">
          <p>Secure multi-chain token distribution powered by smart contracts</p>
        </footer>
      </div>
    </div>
  );
}

export default App;