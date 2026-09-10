import { useWeb3, CONTRACT_ADDRESSES } from '../context/Web3Context';
import { useToast } from '../context/ToastContext';

type Chain = 'celo' | 'base' | 'botchain';

const CHAIN_CONFIG: Record<Chain, { name: string; label: string; color: string; letter: string }> = {
  celo:     { name: 'Celo',      label: 'Mainnet', color: '#FCFF52', letter: 'C' },
  base:     { name: 'Base',      label: 'Mainnet', color: '#0052FF', letter: 'B' },
  botchain: { name: 'BOT Chain', label: 'Testnet', color: '#F0B429', letter: 'T' },
};

export const ChainSelector = () => {
  const { selectedChain, switchChain } = useWeb3();
  const { showToast } = useToast();

  const handleChainSwitch = async (chain: Chain) => {
    if (chain === selectedChain) return;
    try {
      await switchChain(chain);
      showToast(`Switched to ${CHAIN_CONFIG[chain].name}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to switch network', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        {(Object.keys(CHAIN_CONFIG) as Chain[]).map((chain) => {
          const cfg = CHAIN_CONFIG[chain];
          const active = selectedChain === chain;
          return (
            <button
              key={chain}
              onClick={() => handleChainSwitch(chain)}
              style={active ? { borderColor: cfg.color } : {}}
              className={`relative w-full p-3 rounded-lg border text-left transition-all duration-200 ${
                active
                  ? 'bg-[#1a1f2e]'
                  : 'border-[#30363d] bg-[#161b22] hover:bg-[#1a1f2e] hover:border-[#444c56]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-black font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: cfg.color }}
                >
                  {cfg.letter}
                </div>
                <div className="min-w-0">
                  <p className="text-[#e6edf3] font-semibold text-sm truncate">{cfg.name}</p>
                  <p className="text-[#8b949e] text-xs">{cfg.label}</p>
                </div>
                {active && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-3">
        <p className="text-[#8b949e] text-xs mb-1.5">Contract</p>
        <p className="text-[#e6edf3] font-mono text-xs break-all leading-relaxed">
          {CONTRACT_ADDRESSES[selectedChain] || 'Not deployed'}
        </p>
      </div>
    </div>
  );
};