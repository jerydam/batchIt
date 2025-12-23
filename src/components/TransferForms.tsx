import { useState } from 'react';
import { Send, Plus, Trash2, Loader2, Upload } from 'lucide-react';
import { useWeb3, CONTRACT_ADDRESSES, TOKENS } from '../context/Web3Context';
import { useToast } from '../context/ToastContext';
import { CONTRACT_ABI, ERC20_ABI } from '../utils/contracts';
import * as XLSX from 'xlsx';

type TabType = 'equal' | 'different' | 'native';

export const TransferForms = () => {
  const [activeTab, setActiveTab] = useState<TabType>('equal');
  const { web3, account, selectedChain } = useWeb3();
  const { showToast } = useToast();

  const [equalForm, setEqualForm] = useState({
    token: TOKENS[selectedChain][0].address,
    amount: '',
    recipients: ''
  });

  const [differentRecipients, setDifferentRecipients] = useState([{ address: '', amount: '' }]);
  const [differentToken, setDifferentToken] = useState(TOKENS[selectedChain][0].address);

  const [nativeRecipients, setNativeRecipients] = useState([{ address: '', amount: '' }]);

  const [isProcessing, setIsProcessing] = useState(false);

  // Shared file parsing logic
  const parseFile = (
    file: File,
    onSuccess: (data: any[]) => void,
    isEqualTab: boolean = false
  ) => {
    if (file.name.toLowerCase().endsWith('.pdf')) {
      showToast('PDF files are not supported yet.', 'info');
      return;
    }

    const isXlsx = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let rows: any[] = [];

        if (isXlsx) {
          const workbook = XLSX.read(e.target?.result, { type: 'buffer' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        } else {
          const text = e.target?.result as string;
          rows = text.split(/\r?\n/).map(line => line.split(',').map(v => v.trim()));
        }

        const parsed = rows
          .map((row: any) => {
            if (!row || row.length === 0) return null;
            const address = String(row[0]).trim();
            if (!address) return null;
            if (isEqualTab) {
              return address;
            } else {
              const amount = row[1] ? String(row[1]).trim() : '';
              return { address, amount };
            }
          })
          .filter(Boolean);

        if (parsed.length > 0) {
          onSuccess(parsed);
          showToast(`Added ${parsed.length} recipient(s) from file`, 'success');
        } else {
          showToast('No valid data found in file', 'warning');
        }
      } catch (err) {
        showToast('Failed to parse file', 'error');
      }
    };

    if (isXlsx) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const handleEqualFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    parseFile(file, (addresses: string[]) => {
      const current = equalForm.recipients.trim();
      const newRecipients = current ? `${current}\n${addresses.join('\n')}` : addresses.join('\n');
      setEqualForm({ ...equalForm, recipients: newRecipients });
    }, true);

    e.target.value = '';
  };

  const handleDifferentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    parseFile(file, (items: { address: string; amount: string }[]) => {
      const filtered = items.filter(item => item.address && item.amount);
      if (filtered.length > 0) {
        setDifferentRecipients([...differentRecipients, ...filtered]);
      }
    });

    e.target.value = '';
  };

  const handleNativeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    parseFile(file, (items: { address: string; amount: string }[]) => {
      const filtered = items.filter(item => item.address && item.amount);
      if (filtered.length > 0) {
        setNativeRecipients([...nativeRecipients, ...filtered]);
      }
    });

    e.target.value = '';
  };

  // ==================== ORIGINAL TRANSACTION HANDLERS ====================

  const handleEqualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !web3) {
      showToast('Please connect your wallet', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const contract = new web3.eth.Contract(CONTRACT_ABI as any, CONTRACT_ADDRESSES[selectedChain]);
      const recipients = equalForm.recipients
        .split('\n')
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0);

      if (recipients.length === 0) {
        throw new Error('Please enter at least one recipient');
      }

      for (const addr of recipients) {
        if (!web3.utils.isAddress(addr)) {
          throw new Error(`Invalid address: ${addr}`);
        }
      }

      const amountWei = web3.utils.toWei(equalForm.amount, 'ether');
      const totalAmountWei = (BigInt(amountWei) * BigInt(recipients.length)).toString();

      if (equalForm.token !== '0x0000000000000000000000000000000000000000') {
        await checkAndApproveToken(equalForm.token, totalAmountWei);
      }

      showToast('Processing transaction...', 'info');

      let tx;
      if (equalForm.token === '0x0000000000000000000000000000000000000000') {
        tx = await contract.methods.batchTransferETH(
          recipients,
          recipients.map(() => amountWei)
        ).send({ from: account, value: totalAmountWei });
      } else {
        tx = await contract.methods.batchTransferEqual(
          equalForm.token,
          recipients,
          amountWei
        ).send({ from: account });
      }

      showToast(`Transaction successful! ${tx.transactionHash}`, 'success', 8000);
      setEqualForm({ ...equalForm, amount: '', recipients: '' });
    } catch (error: any) {
      showToast(error.message || 'Transaction failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDifferentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !web3) {
      showToast('Please connect your wallet', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const contract = new web3.eth.Contract(CONTRACT_ABI as any, CONTRACT_ADDRESSES[selectedChain]);

      const validRecipients = differentRecipients.filter(r => r.address && r.amount);
      if (validRecipients.length === 0) {
        throw new Error('Please add at least one recipient with amount');
      }

      const recipients = validRecipients.map(r => r.address);
      const amounts = validRecipients.map(r => web3.utils.toWei(r.amount, 'ether'));

      for (const addr of recipients) {
        if (!web3.utils.isAddress(addr)) {
          throw new Error(`Invalid address: ${addr}`);
        }
      }

     const totalAmount = amounts.reduce((acc, amt) =>
  (BigInt(acc) + BigInt(amt)).toString(), '0'
);

      if (differentToken !== '0x0000000000000000000000000000000000000000') {
        await checkAndApproveToken(differentToken, totalAmount);
      }

      showToast('Processing transaction...', 'info');

      let tx;
      if (differentToken === '0x0000000000000000000000000000000000000000') {
        tx = await contract.methods.batchTransferETH(recipients, amounts)
          .send({ from: account, value: totalAmount });
      } else {
        tx = await contract.methods.batchTransfer(differentToken, recipients, amounts)
          .send({ from: account });
      }

      showToast(`Transaction successful! ${tx.transactionHash}`, 'success', 8000);
      setDifferentRecipients([{ address: '', amount: '' }]);
    } catch (error: any) {
      showToast(error.message || 'Transaction failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNativeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !web3) {
      showToast('Please connect your wallet', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const contract = new web3.eth.Contract(CONTRACT_ABI as any, CONTRACT_ADDRESSES[selectedChain]);

      const validRecipients = nativeRecipients.filter(r => r.address && r.amount);
      if (validRecipients.length === 0) {
        throw new Error('Please add at least one recipient with amount');
      }

      const recipients = validRecipients.map(r => r.address);
      const amounts = validRecipients.map(r => web3.utils.toWei(r.amount, 'ether'));

      for (const addr of recipients) {
        if (!web3.utils.isAddress(addr)) {
          throw new Error(`Invalid address: ${addr}`);
        }
      }

     const totalValue = amounts.reduce((acc, amt) =>
  (BigInt(acc) + BigInt(amt)).toString(), '0'
);

      showToast('Processing transaction...', 'info');

      const tx = await contract.methods.batchTransferETH(recipients, amounts)
        .send({ from: account, value: totalValue });

      showToast(`Transaction successful! ${tx.transactionHash}`, 'success', 8000);
      setNativeRecipients([{ address: '', amount: '' }]);
    } catch (error: any) {
      showToast(error.message || 'Transaction failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const checkAndApproveToken = async (tokenAddress: string, requiredAmount: string) => {
    if (!web3 || !account) return;

    const tokenContract = new web3.eth.Contract(ERC20_ABI as any, tokenAddress);
    const allowance = await tokenContract.methods.allowance(account, CONTRACT_ADDRESSES[selectedChain]).call();

    if (BigInt(allowance) < BigInt(requiredAmount)) {
      showToast('Approving token...', 'info');
      await tokenContract.methods.approve(CONTRACT_ADDRESSES[selectedChain], requiredAmount)
        .send({ from: account });
      showToast('Token approved!', 'success');
    }
  };

  const addDifferentRecipient = () => {
    setDifferentRecipients([...differentRecipients, { address: '', amount: '' }]);
  };

  const removeDifferentRecipient = (index: number) => {
    if (differentRecipients.length > 1) {
      setDifferentRecipients(differentRecipients.filter((_, i) => i !== index));
    }
  };

  const addNativeRecipient = () => {
    setNativeRecipients([...nativeRecipients, { address: '', amount: '' }]);
  };

  const removeNativeRecipient = (index: number) => {
    if (nativeRecipients.length > 1) {
      setNativeRecipients(nativeRecipients.filter((_, i) => i !== index));
    }
  };

  // ==================== FILE UPLOAD COMPONENT ====================

  const FileUpload = ({ onChange, description }: { onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; description: string }) => (
    <div>
      <label className="block text-sm font-semibold text-blue-200 mb-2 uppercase tracking-wider">
        Upload Recipients (CSV, TXT, XLSX)
      </label>
      <label className="flex flex-col items-center justify-center gap-3 bg-white/10 border-2 border-dashed border-white/30 rounded-xl p-8 cursor-pointer hover:bg-white/20 transition-all text-center">
        <Upload className="w-10 h-10 text-cyan-400" />
        <p className="text-white font-semibold">Click or drop file here</p>
        <p className="text-xs text-blue-300">{description}</p>
        <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={onChange} />
      </label>
    </div>
  );

  const tabs = [
    { id: 'equal' as TabType, label: 'Equal Amounts' },
    { id: 'different' as TabType, label: 'Different Amounts' },
    { id: 'native' as TabType, label: 'Native Transfer' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 bg-white/10 backdrop-blur-sm p-1.5 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-fit py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                : 'text-blue-200 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'equal' && (
        <form onSubmit={handleEqualSubmit} className="space-y-6 animate-fade-in">
          <div>
            <label className="block text-sm font-semibold text-blue-200 mb-2 uppercase tracking-wider">
              Select Token
            </label>
            <select
              value={equalForm.token}
              onChange={(e) => setEqualForm({ ...equalForm, token: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
            >
              {TOKENS[selectedChain].map(token => (
                <option key={token.address} value={token.address} className="bg-gray-900">
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-blue-200 mb-2 uppercase tracking-wider">
              Amount Per Recipient
            </label>
            <input
              type="number"
              step="any"
              required
              value={equalForm.amount}
              onChange={(e) => setEqualForm({ ...equalForm, amount: e.target.value })}
              placeholder="100"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
            />
          </div>

          <FileUpload
            onChange={handleEqualFileUpload}
            description="One address per line/row"
          />

          <div>
            <label className="block text-sm font-semibold text-blue-200 mb-2 uppercase tracking-wider">
              Recipients (one per line)
            </label>
            <textarea
              required
              rows={8}
              value={equalForm.recipients}
              onChange={(e) => setEqualForm({ ...equalForm, recipients: e.target.value })}
              placeholder="0x123...&#10;0x456...&#10;0x789..."
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isProcessing || !account}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-4 rounded-xl transition-all hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Send Equal Amounts
              </>
            )}
          </button>
        </form>
      )}

      {activeTab === 'different' && (
        <form onSubmit={handleDifferentSubmit} className="space-y-6 animate-fade-in">
          <div>
            <label className="block text-sm font-semibold text-blue-200 mb-2 uppercase tracking-wider">
              Select Token
            </label>
            <select
              value={differentToken}
              onChange={(e) => setDifferentToken(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
            >
              {TOKENS[selectedChain].map(token => (
                <option key={token.address} value={token.address} className="bg-gray-900">
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>

          <FileUpload
            onChange={handleDifferentFileUpload}
            description="address,amount per line/row (comma separated)"
          />

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-blue-200 uppercase tracking-wider">
              Recipients & Amounts
            </label>
            {differentRecipients.map((recipient, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  required={index === 0}
                  value={recipient.address}
                  onChange={(e) => {
                    const updated = [...differentRecipients];
                    updated[index].address = e.target.value;
                    setDifferentRecipients(updated);
                  }}
                  placeholder="0x123..."
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                <input
                  type="number"
                  step="any"
                  required={index === 0}
                  value={recipient.amount}
                  onChange={(e) => {
                    const updated = [...differentRecipients];
                    updated[index].amount = e.target.value;
                    setDifferentRecipients(updated);
                  }}
                  placeholder="Amount"
                  className="w-32 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                {differentRecipients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDifferentRecipient(index)}
                    className="px-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addDifferentRecipient}
              className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Recipient
            </button>
          </div>

          <button
            type="submit"
            disabled={isProcessing || !account}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-4 rounded-xl transition-all hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Send Different Amounts
              </>
            )}
          </button>
        </form>
      )}

      {activeTab === 'native' && (
        <form onSubmit={handleNativeSubmit} className="space-y-6 animate-fade-in">
          <FileUpload
            onChange={handleNativeFileUpload}
            description="address,amount per line/row (comma separated)"
          />

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-blue-200 uppercase tracking-wider">
              Recipients & Native Token Amounts
            </label>
            {nativeRecipients.map((recipient, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  required={index === 0}
                  value={recipient.address}
                  onChange={(e) => {
                    const updated = [...nativeRecipients];
                    updated[index].address = e.target.value;
                    setNativeRecipients(updated);
                  }}
                  placeholder="0x123..."
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                <input
                  type="number"
                  step="any"
                  required={index === 0}
                  value={recipient.amount}
                  onChange={(e) => {
                    const updated = [...nativeRecipients];
                    updated[index].amount = e.target.value;
                    setNativeRecipients(updated);
                  }}
                  placeholder="Amount"
                  className="w-32 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                {nativeRecipients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeNativeRecipient(index)}
                    className="px-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addNativeRecipient}
              className="flex  items-center gap-2 text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Recipient
            </button>
          </div>

          <button
            type="submit"
            disabled={isProcessing || !account}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-4 rounded-xl transition-all hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Send Native Tokens
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};