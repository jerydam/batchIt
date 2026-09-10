import { useState, useEffect, useCallback } from 'react';
import { Send, Plus, Trash2, Loader2, Paperclip } from 'lucide-react';
import { useWeb3, CONTRACT_ADDRESSES, TOKENS, fetchTokenBalanceStandalone, TOKEN_DECIMALS } from '../context/Web3Context';
import { useToast } from '../context/ToastContext';
import { CONTRACT_ABI, ERC20_ABI } from '../utils/contracts';
import * as XLSX from 'xlsx';

type TabType = 'equal' | 'different' | 'native';

const MODES: { id: TabType; label: string }[] = [
  { id: 'equal',     label: 'Equal amounts' },
  { id: 'different', label: 'Custom amounts' },
  { id: 'native',    label: 'Native token'  },
];

const ZERO = '0x0000000000000000000000000000000000000000';

const field =
  'w-full bg-[#0F1629] border border-[#1E2D50] rounded px-3 py-2.5 text-[#E2E8F8] text-sm ' +
  'focus:outline-none focus:border-[#5B8DEF] focus:ring-1 focus:ring-[#5B8DEF]/20 ' +
  'placeholder-[#334155] transition-colors font-mono';

const rowField =
  'bg-[#0F1629] border border-[#1E2D50] rounded px-3 py-2 text-[#E2E8F8] text-sm ' +
  'focus:outline-none focus:border-[#5B8DEF] focus:ring-1 focus:ring-[#5B8DEF]/20 ' +
  'placeholder-[#334155] transition-colors font-mono';

// Decimal-aware unit conversion — avoids toWei() which always assumes 18 decimals
const toTokenUnits = (amount: string, tokenAddress: string): string => {
  const decimals = TOKEN_DECIMALS[tokenAddress.toLowerCase()] ?? 18;
  const float = parseFloat(amount);
  if (isNaN(float) || float <= 0) throw new Error('Invalid amount');
  // Split into integer and fractional parts to avoid floating-point precision loss
  const [whole, frac = ''] = amount.split('.');
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, '0');
  return (BigInt(whole) * BigInt(10 ** decimals) + BigInt(fracPadded)).toString();
};

export const TransferForms = () => {
  const [activeTab, setActiveTab] = useState<TabType>('equal');
  const { web3, account, selectedChain, balance: nativeBalance } = useWeb3();
  const { showToast } = useToast();

  const [equalForm, setEqualForm] = useState({
    token: TOKENS[selectedChain][0].address,
    amount: '',
    recipients: '',
  });
  const [differentRecipients, setDifferentRecipients] = useState([{ address: '', amount: '' }]);
  const [differentToken, setDifferentToken] = useState(TOKENS[selectedChain][0].address);
  const [nativeRecipients, setNativeRecipients] = useState([{ address: '', amount: '' }]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [equalTokenBalance, setEqualTokenBalance] = useState<string | null>(null);
  const [differentTokenBalance, setDifferentTokenBalance] = useState<string | null>(null);
  const [isFetchingBal, setIsFetchingBal] = useState(false);

  // Stable — delegates to module-level function exported from context
  const fetchTokenBalance = useCallback(async (tokenAddress: string): Promise<string | null> => {
    if (!web3 || !account) return null;
    return fetchTokenBalanceStandalone(web3, account, tokenAddress);
  }, [web3, account]);

  // Fetch balance for equal-tab token
  useEffect(() => {
    if (!account) { setEqualTokenBalance(null); return; }
    setIsFetchingBal(true);
    fetchTokenBalance(equalForm.token)
      .then(setEqualTokenBalance)
      .finally(() => setIsFetchingBal(false));
  }, [equalForm.token, account, fetchTokenBalance]);

  // Fetch balance for different-tab token
  useEffect(() => {
    if (!account) { setDifferentTokenBalance(null); return; }
    fetchTokenBalance(differentToken).then(setDifferentTokenBalance);
  }, [differentToken, account, fetchTokenBalance]);

  // Reset token selections when chain changes
  useEffect(() => {
    const first = TOKENS[selectedChain][0].address;
    setEqualForm(f => ({ ...f, token: first }));
    setDifferentToken(first);
    setEqualTokenBalance(null);
    setDifferentTokenBalance(null);
  }, [selectedChain]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const symbolFor = (address: string) =>
    TOKENS[selectedChain].find(t => t.address.toLowerCase() === address.toLowerCase())?.symbol ?? '';

  const nativeSymbol =
    selectedChain === 'celo' ? 'CELO' : selectedChain === 'base' ? 'ETH' : 'BOT';

  // ── Balance badge ─────────────────────────────────────────────────────────

  const BalanceBadge = ({
    bal, symbol, loading,
  }: {
    bal: string | null; symbol: string; loading?: boolean;
  }) => {
    if (!account) return null;
    return (
      <span className="text-xs text-[#64748B] font-mono">
        {loading ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            fetching…
          </span>
        ) : bal !== null ? (
          <>Balance: <span className="text-[#94A3B8]">{bal} {symbol}</span></>
        ) : (
          'Balance: —'
        )}
      </span>
    );
  };

  // ── File parsing ──────────────────────────────────────────────────────────

  const parseFile = (file: File, onSuccess: (data: any[]) => void, isEqualTab = false) => {
    if (file.name.toLowerCase().endsWith('.pdf')) {
      showToast('PDF files are not supported.', 'info');
      return;
    }
    const isXlsx = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let rows: any[] = [];
        if (isXlsx) {
          const wb = XLSX.read(e.target?.result, { type: 'buffer' });
          rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        } else {
          rows = (e.target?.result as string)
            .split(/\r?\n/)
            .map(line => line.split(',').map(v => v.trim()));
        }
        const parsed = rows
          .map((row: any) => {
            const address = String(row?.[0] ?? '').trim();
            if (!address) return null;
            return isEqualTab ? address : { address, amount: String(row[1] ?? '').trim() };
          })
          .filter(Boolean);
        if (parsed.length > 0) {
          onSuccess(parsed);
          showToast(`Loaded ${parsed.length} recipient(s)`, 'success');
        } else {
          showToast('No valid rows found in file', 'warning');
        }
      } catch { showToast('Failed to parse file', 'error'); }
    };
    if (isXlsx) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const handleEqualFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    parseFile(file, (addresses: string[]) => {
      const current = equalForm.recipients.trim();
      setEqualForm({ ...equalForm, recipients: current ? `${current}\n${addresses.join('\n')}` : addresses.join('\n') });
    }, true);
    e.target.value = '';
  };

  const handleDifferentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    parseFile(file, (items: { address: string; amount: string }[]) => {
      const valid = items.filter(i => i.address && i.amount);
      if (valid.length) setDifferentRecipients(prev => [...prev, ...valid]);
    });
    e.target.value = '';
  };

  const handleNativeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    parseFile(file, (items: { address: string; amount: string }[]) => {
      const valid = items.filter(i => i.address && i.amount);
      if (valid.length) setNativeRecipients(prev => [...prev, ...valid]);
    });
    e.target.value = '';
  };

  // ── Token approval ────────────────────────────────────────────────────────

  const checkAndApproveToken = async (tokenAddress: string, requiredAmount: string) => {
    if (!web3 || !account) return;
    const tokenContract = new web3.eth.Contract(ERC20_ABI as any, tokenAddress);
    const allowance = await tokenContract.methods
      .allowance(account, CONTRACT_ADDRESSES[selectedChain])
      .call() as string;
    if (BigInt(allowance) < BigInt(requiredAmount)) {
      showToast('Approving token spend…', 'info');
      await tokenContract.methods
        .approve(CONTRACT_ADDRESSES[selectedChain], requiredAmount)
        .send({ from: account });
      showToast('Spend approved', 'success');
    }
  };

  // ── Submit handlers ───────────────────────────────────────────────────────

  const handleEqualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !web3) { showToast('Connect your wallet first', 'error'); return; }
    setIsProcessing(true);
    try {
      const contract = new web3.eth.Contract(CONTRACT_ABI as any, CONTRACT_ADDRESSES[selectedChain]);
      const recipients = equalForm.recipients.split('\n').map(a => a.trim()).filter(Boolean);
      if (!recipients.length) throw new Error('Enter at least one recipient address');
      for (const addr of recipients) {
        if (!web3.utils.isAddress(addr)) throw new Error(`Invalid address: ${addr}`);
      }

      const isNative = equalForm.token === ZERO;

      // Use toWei for native (18 decimals always), toTokenUnits for ERC-20
      const amountUnits = isNative
        ? web3.utils.toWei(equalForm.amount, 'ether')
        : toTokenUnits(equalForm.amount, equalForm.token);

      const totalUnits = (BigInt(amountUnits) * BigInt(recipients.length)).toString();

      if (!isNative) await checkAndApproveToken(equalForm.token, totalUnits);

      showToast('Sending transaction…', 'info');

      // Contract: batchTransferEqual(token, recipients, amount)
      // ETH: token = address(0), send msg.value
      // ERC20: token = contract address, msg.value = 0
      const tx = await contract.methods
        .batchTransferEqual(equalForm.token, recipients, amountUnits)
        .send({ from: account, value: isNative ? totalUnits : '0' });

      showToast(`Sent · ${tx.transactionHash}`, 'success', 8000);
      setEqualForm({ ...equalForm, amount: '', recipients: '' });
    } catch (err: any) {
      showToast(err.message || 'Transaction failed', 'error');
    } finally { setIsProcessing(false); }
  };

  // ── Native check helper (case-insensitive) ────────────────────────────────
const isNativeToken = (addr: string) =>
  addr.toLowerCase() === ZERO.toLowerCase();

const handleDifferentSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!account || !web3) { showToast('Connect your wallet first', 'error'); return; }
  setIsProcessing(true);
  try {
    const contract = new web3.eth.Contract(CONTRACT_ABI as any, CONTRACT_ADDRESSES[selectedChain]);
    const valid = differentRecipients.filter(r => r.address.trim() && r.amount.trim());
    if (!valid.length) throw new Error('Add at least one recipient with an amount');

    const recipients = valid.map(r => r.address.trim());
    for (const addr of recipients) {
      if (!web3.utils.isAddress(addr)) throw new Error(`Invalid address: ${addr}`);
    }

    const native = isNativeToken(differentToken);

    const amounts = valid.map(r => {
      if (native) return web3.utils.toWei(r.amount.trim(), 'ether');
      return toTokenUnits(r.amount.trim(), differentToken);
    });

    const total = amounts.reduce((acc, amt) => (BigInt(acc) + BigInt(amt)).toString(), '0');

    if (!native) await checkAndApproveToken(differentToken, total);

    showToast('Sending transaction…', 'info');

    const tx = await contract.methods
      .batchTransfer(
        native ? ZERO : differentToken,  // always send checksum-safe ZERO for native
        recipients,
        amounts
      )
      .send({ from: account, value: native ? total : '0' });

    showToast(`Sent · ${tx.transactionHash}`, 'success', 8000);
    setDifferentRecipients([{ address: '', amount: '' }]);
  } catch (err: any) {
    showToast(err.message || 'Transaction failed', 'error');
  } finally { setIsProcessing(false); }
};
  const handleNativeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !web3) { showToast('Connect your wallet first', 'error'); return; }
    setIsProcessing(true);
    try {
      const contract = new web3.eth.Contract(CONTRACT_ABI as any, CONTRACT_ADDRESSES[selectedChain]);
      const valid = nativeRecipients.filter(r => r.address && r.amount);
      if (!valid.length) throw new Error('Add at least one recipient with an amount');

      const recipients = valid.map(r => r.address);
      for (const addr of recipients) {
        if (!web3.utils.isAddress(addr)) throw new Error(`Invalid address: ${addr}`);
      }

      const amounts = valid.map(r => web3.utils.toWei(r.amount, 'ether'));
      const total = amounts.reduce((acc, amt) => (BigInt(acc) + BigInt(amt)).toString(), '0');

      showToast('Sending transaction…', 'info');

      // Native transfer: pass address(0) as token, send msg.value
      const tx = await contract.methods
        .batchTransfer(ZERO, recipients, amounts)
        .send({ from: account, value: total });

      showToast(`Sent · ${tx.transactionHash}`, 'success', 8000);
      setNativeRecipients([{ address: '', amount: '' }]);
    } catch (err: any) {
      showToast(err.message || 'Transaction failed', 'error');
    } finally { setIsProcessing(false); }
  };

  // ── Recipient helpers ─────────────────────────────────────────────────────

  const updateDiff = (i: number, key: 'address' | 'amount', v: string) =>
    setDifferentRecipients(prev => { const n = [...prev]; n[i] = { ...n[i], [key]: v }; return n; });

  const updateNative = (i: number, key: 'address' | 'amount', v: string) =>
    setNativeRecipients(prev => { const n = [...prev]; n[i] = { ...n[i], [key]: v }; return n; });

  // ── Sub-components ────────────────────────────────────────────────────────

  const FileButton = ({
    onChange, label,
  }: { onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; label: string }) => (
    <label className="inline-flex items-center gap-1.5 text-[#5B8DEF] hover:text-[#7AAAF5] text-xs cursor-pointer transition-colors">
      <Paperclip className="w-3.5 h-3.5" />
      {label}
      <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={onChange} />
    </label>
  );

  const TokenSelect = ({
    value, onChange, tokenBalance, loading,
  }: {
    value: string; onChange: (v: string) => void; tokenBalance: string | null; loading?: boolean;
  }) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-[#64748B]">Token</label>
        <BalanceBadge bal={tokenBalance} symbol={symbolFor(value)} loading={loading} />
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={field + ' cursor-pointer'}
      >
        {TOKENS[selectedChain].map(token => (
          <option key={token.address} value={token.address} className="bg-[#0F1629]">
            {token.symbol}
          </option>
        ))}
      </select>
    </div>
  );

  const RecipientTable = ({
    rows, onUpdate, onAdd, onRemove, onFileUpload, showAmount, amountPlaceholder,
  }: {
    rows: { address: string; amount: string }[];
    onUpdate: (i: number, key: 'address' | 'amount', v: string) => void;
    onAdd: () => void;
    onRemove: (i: number) => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    showAmount: boolean;
    amountPlaceholder?: string;
  }) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-[#64748B]">
          Recipients <span className="text-[#334155]">({rows.length})</span>
        </label>
        <FileButton onChange={onFileUpload} label="Import file" />
      </div>
      <div className={`grid gap-2 mb-1 px-1 ${showAmount ? 'grid-cols-[1fr_120px_32px]' : 'grid-cols-[1fr_32px]'}`}>
        <span className="text-[10px] text-[#334155]">Address</span>
        {showAmount && <span className="text-[10px] text-[#334155]">Amount</span>}
        <span />
      </div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
        {rows.map((row, i) => (
          <div key={i} className={`grid gap-2 items-center ${showAmount ? 'grid-cols-[1fr_120px_32px]' : 'grid-cols-[1fr_32px]'}`}>
            <input
              type="text"
              value={row.address}
              onChange={e => onUpdate(i, 'address', e.target.value)}
              placeholder="0x…"
              className={rowField + ' w-full'}
              required={i === 0}
            />
            {showAmount && (
              <input
                type="number"
                step="any"
                value={row.amount}
                onChange={e => onUpdate(i, 'amount', e.target.value)}
                placeholder={amountPlaceholder ?? '0.0'}
                className={rowField + ' w-full'}
                required={i === 0}
              />
            )}
            <button
              type="button"
              onClick={() => onRemove(i)}
              disabled={rows.length === 1}
              className="w-8 h-8 flex items-center justify-center rounded border border-[#1E2D50] hover:border-red-500/40 hover:bg-red-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-[#64748B]" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#E2E8F8] transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add recipient
      </button>
    </div>
  );

  const SubmitButton = ({ label }: { label: string }) => (
    <button
      type="submit"
      disabled={isProcessing || !account}
      className="w-full flex items-center justify-center gap-2 bg-[#5B8DEF] hover:bg-[#4A7ADB] text-white font-semibold py-2.5 rounded text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {isProcessing
        ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</>
        : <><Send className="w-4 h-4" />{label}</>}
    </button>
  );

  // ── Mode switcher ─────────────────────────────────────────────────────────

  const modeIndex = MODES.findIndex(m => m.id === activeTab);

  return (
    <div>
      {/* Segmented control */}
      <div className="relative flex bg-[#0F1629] border border-[#1E2D50] rounded-md p-0.5 mb-6 w-full">
        <div
          className="absolute top-0.5 bottom-0.5 rounded transition-all duration-200 bg-[#182040] border border-[#2D4070]"
          style={{
            width: `calc(${100 / MODES.length}% - 4px)`,
            left: `calc(${(modeIndex * 100) / MODES.length}% + 2px)`,
          }}
        />
        {MODES.map(mode => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setActiveTab(mode.id)}
            className={`relative z-10 flex-1 py-2 text-xs font-medium rounded transition-colors ${
              activeTab === mode.id ? 'text-[#E2E8F8]' : 'text-[#64748B] hover:text-[#94A3B8]'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Equal amounts */}
      {activeTab === 'equal' && (
        <form onSubmit={handleEqualSubmit} className="space-y-5">
          <TokenSelect
            value={equalForm.token}
            onChange={v => setEqualForm({ ...equalForm, token: v })}
            tokenBalance={equalTokenBalance}
            loading={isFetchingBal}
          />
          <div>
            <label className="block text-xs text-[#64748B] mb-1.5">Amount per recipient</label>
            <input
              type="number"
              step="any"
              required
              value={equalForm.amount}
              onChange={e => setEqualForm({ ...equalForm, amount: e.target.value })}
              placeholder="0.0"
              className={field}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-[#64748B]">
                Recipients{' '}
                <span className="text-[#334155]">
                  ({equalForm.recipients.split('\n').filter(l => l.trim()).length})
                </span>
              </label>
              <FileButton onChange={handleEqualFileUpload} label="Import file" />
            </div>
            <textarea
              required
              rows={6}
              value={equalForm.recipients}
              onChange={e => setEqualForm({ ...equalForm, recipients: e.target.value })}
              placeholder={'0x1234…\n0x5678…\n0xabcd…'}
              className={field + ' resize-none leading-relaxed'}
            />
          </div>
          <SubmitButton label="Send to all" />
        </form>
      )}

      {/* Custom amounts */}
      {activeTab === 'different' && (
        <form onSubmit={handleDifferentSubmit} className="space-y-5">
          <TokenSelect
            value={differentToken}
            onChange={setDifferentToken}
            tokenBalance={differentTokenBalance}
          />
          <RecipientTable
            rows={differentRecipients}
            onUpdate={updateDiff}
            onAdd={() => setDifferentRecipients(prev => [...prev, { address: '', amount: '' }])}
            onRemove={i => setDifferentRecipients(prev => prev.filter((_, idx) => idx !== i))}
            onFileUpload={handleDifferentFileUpload}
            showAmount
          />
          <SubmitButton label="Send" />
        </form>
      )}

      {/* Native token */}
      {activeTab === 'native' && (
        <form onSubmit={handleNativeSubmit} className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-[#64748B]">Token</label>
              <BalanceBadge bal={nativeBalance} symbol={nativeSymbol} />
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 rounded border border-[#1E2D50] bg-[#0F1629]">
              <span className="text-sm text-[#E2E8F8] font-mono">{nativeSymbol}</span>
              <span className="text-xs text-[#64748B]">native</span>
            </div>
          </div>
          <RecipientTable
            rows={nativeRecipients}
            onUpdate={updateNative}
            onAdd={() => setNativeRecipients(prev => [...prev, { address: '', amount: '' }])}
            onRemove={i => setNativeRecipients(prev => prev.filter((_, idx) => idx !== i))}
            onFileUpload={handleNativeFileUpload}
            showAmount
          />
          <SubmitButton label="Send" />
        </form>
      )}

      {!account && (
        <p className="mt-3 text-center text-xs text-[#334155]">Connect your wallet to send</p>
      )}
    </div>
  );
};