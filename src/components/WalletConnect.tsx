import { Wallet, LogOut, Loader2 } from 'lucide-react';
import { useWeb3 } from '../context/Web3Context';
import { useToast } from '../context/ToastContext';

export const WalletConnect = () => {
  const { account, balance, connectWallet, disconnectWallet, isConnecting, selectedChain } = useWeb3();
  const { showToast } = useToast();

  const handleConnect = async () => {
    try {
      await connectWallet();
      showToast('Wallet connected successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to connect wallet', 'error');
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    showToast('Wallet disconnected', 'info');
  };

  const nativeToken = selectedChain === 'celo' ? 'CELO' : 'ETH';

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl">
      {account ? (
        <>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 items-center flex-1">
            <div className="text-center sm:text-left">
              <p className="text-xs text-blue-200 font-medium uppercase tracking-wider mb-1">Account</p>
              <p className="text-white font-mono text-sm">
                {account.slice(0, 6)}...{account.slice(-4)}
              </p>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xs text-blue-200 font-medium uppercase tracking-wider mb-1">Balance</p>
              <p className="text-white font-semibold">{balance} {nativeToken}</p>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-white px-6 py-2.5 rounded-xl font-semibold transition-all hover:scale-105 border border-red-500/40"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        </>
      ) : (
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-8 py-3 rounded-xl font-bold transition-all hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="w-5 h-5" />
              Connect Wallet
            </>
          )}
        </button>
      )}
    </div>
  );
};