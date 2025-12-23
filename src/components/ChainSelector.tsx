import { useWeb3, CONTRACT_ADDRESSES } from '../context/Web3Context';
import { useToast } from '../context/ToastContext';

export const ChainSelector = () => {
  const { selectedChain, switchChain } = useWeb3();
  const { showToast } = useToast();

  const handleChainSwitch = async (chain: 'celo' | 'base') => {
    if (chain === selectedChain) return;

    try {
      await switchChain(chain);
      showToast(`Switched to ${chain === 'celo' ? 'Celo' : 'Base'} network`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to switch network', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => handleChainSwitch('celo')}
          className={`relative overflow-hidden p-6 rounded-2xl border-2 transition-all duration-300 ${
            selectedChain === 'celo'
              ? 'border-yellow-400 bg-yellow-400/20 shadow-lg shadow-yellow-400/20'
              : 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center text-black font-bold text-xl">
              C
            </div>
            <div className="text-left">
              <h3 className="text-white font-bold text-lg">Celo</h3>
              <p className="text-blue-200 text-xs">Mainnet</p>
            </div>
          </div>
          {selectedChain === 'celo' && (
            <div className="absolute top-2 right-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            </div>
          )}
        </button>

        <button
          onClick={() => handleChainSwitch('base')}
          className={`relative overflow-hidden p-6 rounded-2xl border-2 transition-all duration-300 ${
            selectedChain === 'base'
              ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/20'
              : 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xl">
              B
            </div>
            <div className="text-left">
              <h3 className="text-white font-bold text-lg">Base</h3>
              <p className="text-blue-200 text-xs">Mainnet</p>
            </div>
          </div>
          {selectedChain === 'base' && (
            <div className="absolute top-2 right-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            </div>
          )}
        </button>
      </div>

      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
        <p className="text-xs text-blue-200 font-medium uppercase tracking-wider mb-2">Contract Address</p>
        <p className="text-white font-mono text-xs break-all">
          {CONTRACT_ADDRESSES[selectedChain]}
        </p>
      </div>
    </div>
  );
};