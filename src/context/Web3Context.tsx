import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Web3 from 'web3';

interface Web3ContextType {
  web3: Web3 | null;
  account: string | null;
  balance: string;
  chainId: number | null;
  selectedChain: 'celo' | 'base' | 'botchain';
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchChain: (chain: 'celo' | 'base' | 'botchain') => Promise<void>;
  isConnecting: boolean;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export const CONTRACT_ADDRESSES = {
  celo:     '0x634B0B2353D05e644d81C1Ab395f4b266E575830',
  base:     '0x0584aa5138E12275212C390E7B398fDb4B1c94B9',
  botchain: '0x1AD33fb2512b41C9d27d62D4cac51Bdd907DbC49',
};

export const CHAIN_IDS = {
  celo:     42220,
  base:     8453,
  botchain: 968,
};

export const TOKENS = {
  celo: [
    { symbol: 'CELO', address: '0x471EcE3750Da237f93B8E339c536989b8978a438' },
    { symbol: 'cUSD', address: '0x765DE816845861e75A25fCa122bb6898B8B1282a' },
    { symbol: 'cEUR', address: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73' },
  ],
  base: [
    { symbol: 'ETH',  address: '0x0000000000000000000000000000000000000000' },
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { symbol: 'DAI',  address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' },
  ],
  botchain: [
    { symbol: 'BOT',  address: '0x0000000000000000000000000000000000000000' },
    { symbol: 'USDT', address: '0x75edC9335175Fc0552D51D48439F229c10420fe3' },
  ],
};

// ── Constants outside component so they never change reference ────────────

const ZERO = '0x0000000000000000000000000000000000000000';

// Hardcoded decimals — avoids calling decimals() on precompiles
export const TOKEN_DECIMALS: Record<string, number> = {
  '0x471ece3750da237f93b8e339c536989b8978a438': 18, // CELO
  '0x765de816845861e75a25fca122bb6898b8b1282a': 18, // cUSD
  '0xd8763cba276a3738e6de85b4b3bf5fded6d6ca73': 18, // cEUR
  '0x0000000000000000000000000000000000000000': 18, // ETH / BOT native
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 6,  // USDC
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': 18, // DAI
  '0x75edc9335175fc0552d51d48439f229c10420fe3': 6, // USDT
};

const BAL_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
];

// Native coin per chain — CELO is an ERC-20 so uses balanceOf;
// zero address = use eth_getBalance
const NATIVE_ADDRESS: Record<string, string> = {
  celo:     '0x471EcE3750Da237f93B8E339c536989b8978a438',
  base:     ZERO,
  botchain: ZERO,
};

const formatUnits = (raw: bigint, decimals: number): string => {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = (raw % divisor).toString().padStart(decimals, '0').slice(0, 4);
  return `${whole}.${frac}`;
};

// Standalone — not inside any component, so it never causes stale closure issues
const fetchNativeBalance = async (
  web3: Web3,
  address: string,
  chain: 'celo' | 'base' | 'botchain'
): Promise<string> => {
  try {
    const nativeAddr = NATIVE_ADDRESS[chain];

    if (nativeAddr === ZERO) {
      const raw = await web3.eth.getBalance(address);
      return formatUnits(BigInt(raw.toString()), 18);
    }

    // CELO: balanceOf on the ERC-20 contract
    const contract = new web3.eth.Contract(BAL_ABI as any, nativeAddr);
    const raw = BigInt(await contract.methods.balanceOf(address).call() as string);
    return formatUnits(raw, 18);
  } catch (err) {
    console.error('Error fetching native balance:', err);
    return '0';
  }
};

// Exported so TransferForms can reuse the same logic
export const fetchTokenBalanceStandalone = async (
  web3: Web3,
  account: string,
  tokenAddress: string
): Promise<string | null> => {
  try {
    const addr = tokenAddress.toLowerCase();
    let raw: bigint;

    if (addr === ZERO) {
      raw = BigInt((await web3.eth.getBalance(account)).toString());
    } else {
      const contract = new web3.eth.Contract(BAL_ABI as any, tokenAddress);
      raw = BigInt(await contract.methods.balanceOf(account).call() as string);
    }

    const decimals = TOKEN_DECIMALS[addr] ?? 18;
    return formatUnits(raw, decimals);
  } catch (err) {
    console.error('Error fetching token balance:', err);
    return null;
  }
};

export const Web3Provider = ({ children }: { children: ReactNode }) => {
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState('0');
  const [chainId, setChainId] = useState<number | null>(null);
  const [selectedChain, setSelectedChain] = useState<'celo' | 'base' | 'botchain'>('celo');
  const [isConnecting, setIsConnecting] = useState(false);

  // Keep a ref to selectedChain so event listeners always read the latest value
  const selectedChainRef = { current: selectedChain };
  selectedChainRef.current = selectedChain;

  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return;

    const web3Instance = new Web3(window.ethereum);
    setWeb3(web3Instance);
    checkConnection(web3Instance);

    const onAccountsChanged = async (accounts: string[]) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        const bal = await fetchNativeBalance(web3Instance, accounts[0], selectedChainRef.current);
        setBalance(bal);
      } else {
        setAccount(null);
        setBalance('0');
      }
    };

    const onChainChanged = () => window.location.reload();

    window.ethereum.on('accountsChanged', onAccountsChanged);
    window.ethereum.on('chainChanged', onChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', onAccountsChanged);
      window.ethereum?.removeListener('chainChanged', onChainChanged);
    };
  }, []);

  // Re-fetch balance when chain or account changes
  useEffect(() => {
    if (web3 && account) {
      fetchNativeBalance(web3, account, selectedChain).then(setBalance);
    }
  }, [selectedChain, account, web3]);

  const detectChain = (id: number): 'celo' | 'base' | 'botchain' | null => {
    const entry = Object.entries(CHAIN_IDS).find(([, v]) => v === id);
    return entry ? (entry[0] as 'celo' | 'base' | 'botchain') : null;
  };

  const checkConnection = async (web3Instance: Web3) => {
    try {
      const accounts = await window.ethereum?.request({ method: 'eth_accounts' }) as string[];
      if (!accounts?.length) return;

      const chainIdHex = await window.ethereum?.request({ method: 'eth_chainId' }) as string;
      const id = parseInt(chainIdHex, 16);
      const detected = detectChain(id) ?? 'celo';

      setAccount(accounts[0]);
      setChainId(id);
      setSelectedChain(detected);

      const bal = await fetchNativeBalance(web3Instance, accounts[0], detected);
      setBalance(bal);
    } catch (err) {
      console.error('Error checking connection:', err);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) throw new Error('MetaMask is not installed');
    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      const id = parseInt(chainIdHex, 16);
      const detected = detectChain(id) ?? selectedChain;

      setAccount(accounts[0]);
      setChainId(id);
      setSelectedChain(detected);

      if (web3) {
        const bal = await fetchNativeBalance(web3, accounts[0], detected);
        setBalance(bal);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setBalance('0');
    setChainId(null);
  };

  const switchChain = async (chain: 'celo' | 'base' | 'botchain') => {
    setSelectedChain(chain);
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + CHAIN_IDS[chain].toString(16) }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        const configs: Record<string, { chainName: string; rpcUrls: string[]; nativeCurrency: { name: string; symbol: string; decimals: number } }> = {
          botchain: {
            chainName: 'BOT Chain Testnet',
            rpcUrls: ['https://rpc.bohr.life'],
            nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
          },
        };
        if (configs[chain]) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{ chainId: '0x' + CHAIN_IDS[chain].toString(16), ...configs[chain] }],
          });
        } else {
          throw new Error(`Please add ${chain} network to your wallet`);
        }
      } else {
        throw error;
      }
    }
  };

  return (
    <Web3Context.Provider value={{ web3, account, balance, chainId, selectedChain, connectWallet, disconnectWallet, switchChain, isConnecting }}>
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) throw new Error('useWeb3 must be used within Web3Provider');
  return context;
};