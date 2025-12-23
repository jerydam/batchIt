import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Web3 from 'web3';

interface Web3ContextType {
  web3: Web3 | null;
  account: string | null;
  balance: string;
  chainId: number | null;
  selectedChain: 'celo' | 'base';
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchChain: (chain: 'celo' | 'base') => Promise<void>;
  isConnecting: boolean;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export const CONTRACT_ADDRESSES = {
  celo: '0x634B0B2353D05e644d81C1Ab395f4b266E575830',
  base: '0x0584aa5138E12275212C390E7B398fDb4B1c94B9'
};

export const CHAIN_IDS = {
  celo: 42220,
  base: 8453
};

export const TOKENS = {
  celo: [
    { symbol: 'Celo', address: '0x471ece3750da237f93b8e339c536989b8978a438' },
    { symbol: 'cUSD', address: '0x765de816845861e75a25fca122bb6898b8b1282a' },
    { symbol: 'cEUR', address: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73' }
  ],
  base: [
    { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000' },
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { symbol: 'DAI', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' }
  ]
};

export const Web3Provider = ({ children }: { children: ReactNode }) => {
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState('0');
  const [chainId, setChainId] = useState<number | null>(null);
  const [selectedChain, setSelectedChain] = useState<'celo' | 'base'>('celo');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      const web3Instance = new Web3(window.ethereum);
      setWeb3(web3Instance);

      checkConnection();

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const checkConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          await updateBalance(accounts[0]);
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          setChainId(parseInt(chainId, 16));
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    }
  };

  const handleAccountsChanged = async (accounts: string[]) => {
    if (accounts.length > 0) {
      setAccount(accounts[0]);
      await updateBalance(accounts[0]);
    } else {
      setAccount(null);
      setBalance('0');
    }
  };

  const handleChainChanged = (chainIdHex: string) => {
    setChainId(parseInt(chainIdHex, 16));
    window.location.reload();
  };

  const updateBalance = async (address: string) => {
    if (web3) {
      try {
        const balanceWei = await web3.eth.getBalance(address);
        const balanceEth = web3.utils.fromWei(balanceWei, 'ether');
        setBalance(parseFloat(balanceEth).toFixed(4));
      } catch (error) {
        console.error('Error updating balance:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      setIsConnecting(true);
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
        await updateBalance(accounts[0]);
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainId, 16));
      } catch (error) {
        console.error('Error connecting wallet:', error);
        throw error;
      } finally {
        setIsConnecting(false);
      }
    } else {
      throw new Error('MetaMask is not installed');
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setBalance('0');
    setChainId(null);
  };

  const switchChain = async (chain: 'celo' | 'base') => {
    setSelectedChain(chain);

    if (typeof window.ethereum !== 'undefined') {
      try {
        const chainIdHex = '0x' + CHAIN_IDS[chain].toString(16);
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }]
        });
      } catch (error: any) {
        if (error.code === 4902) {
          throw new Error(`Please add ${chain} network to MetaMask`);
        }
        throw error;
      }
    }
  };

  return (
    <Web3Context.Provider
      value={{
        web3,
        account,
        balance,
        chainId,
        selectedChain,
        connectWallet,
        disconnectWallet,
        switchChain,
        isConnecting
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within Web3Provider');
  }
  return context;
};
