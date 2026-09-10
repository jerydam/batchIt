import { Wallet, LogOut, Loader2, Circle } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { useToast } from '../context/ToastContext';

const NATIVE_TOKEN: Record<string, string> = {
  celo: 'CELO',
  base: 'ETH',
  botchain: 'BOT',
};

export const WalletConnect = () => {
  const { account, balance, connectWallet, disconnectWallet, isConnecting, selectedChain } = useWeb3();
  const { showToast } = useToast();

  const handleConnect = async () => {
    try {
      await connectWallet();
      showToast('Wallet connected', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to connect wallet', 'error');
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    showToast('Wallet disconnected', 'info');
  };

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] px-4 py-4">
      {account ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400" />
              <span className="text-[#8b949e] text-xs">Connected</span>
            </div>
            <div className="min-w-0">
              <p className="text-[#8b949e] text-xs mb-0.5">Address</p>
              <p className="text-[#e6edf3] font-mono text-sm truncate">
                {account.slice(0, 8)}…{account.slice(-6)}
              </p>
            </div>
            <div className="flex-shrink-0">
              <p className="text-[#8b949e] text-xs mb-0.5">Balance</p>
              <p className="text-[#e6edf3] font-mono text-sm">
                {balance} <span className="text-[#8b949e]">{NATIVE_TOKEN[selectedChain]}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 text-[#8b949e] hover:text-[#e6edf3] text-sm transition-colors border border-[#30363d] hover:border-[#444c56] px-4 py-2 rounded-md w-full sm:w-auto justify-center"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-[#e6edf3] font-medium text-sm">No wallet connected</p>
            <p className="text-[#8b949e] text-xs mt-0.5">Connect to start sending tokens</p>
          </div>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center justify-center gap-2 bg-[#F0B429] hover:bg-[#d9a224] text-black font-semibold px-5 py-2.5 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            {isConnecting ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Connecting…</>
            ) : (
              <><Wallet className="w-4 h-4" />Connect Wallet</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};