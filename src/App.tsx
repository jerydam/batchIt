import { ArrowRightLeft } from 'lucide-react';
import { WalletConnect } from './components/WalletConnect';
import { ChainSelector } from './components/ChainSelector';
import { TransferForms } from './components/TransferForms';

function App() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top bar */}
      <header className="border-b border-[#21262d] px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#F0B429] flex items-center justify-center flex-shrink-0">
              <ArrowRightLeft className="w-4 h-4 text-black" />
            </div>
            <span className="font-semibold text-[#e6edf3] tracking-tight">BatchSend</span>
          </div>
          <span className="text-[#8b949e] text-xs hidden sm:block">Multi-chain token distribution</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Page title */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#e6edf3] tracking-tight">Batch Transfer</h1>
          <p className="text-[#8b949e] text-sm mt-1">
            Distribute tokens to multiple recipients in a single on-chain transaction.
          </p>
        </div>

        <div className="space-y-4">
          <WalletConnect />

          {/* Stack on mobile, side-by-side on lg+ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Network panel */}
            <div className="rounded-lg border border-[#21262d] bg-[#0d1117] p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-[#e6edf3] mb-4">Network</h2>
              <ChainSelector />
            </div>

            {/* Transfer panel */}
            <div className="lg:col-span-2 rounded-lg border border-[#21262d] bg-[#0d1117] p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-[#e6edf3] mb-4">Transfer</h2>
              <TransferForms />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#21262d] mt-12 px-4 sm:px-6 py-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[#484f58] text-xs">BatchSend · Secure on-chain distribution</p>
          <p className="text-[#484f58] text-xs">Celo · Base · BOT Chain</p>
        </div>
      </footer>
    </div>
  );
}

export default App;