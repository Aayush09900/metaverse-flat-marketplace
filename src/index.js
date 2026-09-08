import { ethers } from 'ethers';
import abi from './abi.json';

const CONFIG = window.METAVERSE_CONFIG;
const $ = (id) => document.getElementById(id);

let provider = null;
let signer = null;
let contract = null;
let userAddress = null;
let totalFlats = CONFIG.totalFlatsFallback;
let flatPrice = null;
let flatsCache = [];
let activeFilter = 'all';
let pendingFlatId = null;

const els = {
  connect: $('connectWalletBtn'), wallet: $('wallet'), walletBalance: $('walletBalance'), contractBalance: $('contractBalance'), contractOwner: $('contractOwner'), status: $('statusMessage'), networkLabel: $('networkLabel'), networkDot: $('networkDot'), totalFlats: $('totalFlatsStat'), availableFlats: $('availableFlatsStat'), flatPrice: $('flatPriceStat'), listingState: $('listingState'), flats: $('flats'), activity: $('activityList'), search: $('flatSearch'), bookingModal: $('bookingModal'), bookingTitle: $('bookingTitle'), bookingStatus: $('bookingStatus'), bookingPrice: $('bookingPrice'), bookingNotice: $('bookingNotice'), confirmBooking: $('confirmBooking')
};

function shortAddress(value) { return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—'; }
function formatEth(value) { return `${Number(ethers.formatEther(value)).toFixed(4)} ETH`; }
function txUrl(hash) { return `${CONFIG.explorerBaseUrl}/tx/${hash}`; }
function setStatus(message) { els.status.textContent = message; }
function showModal() { els.bookingModal.classList.add('active'); els.bookingModal.setAttribute('aria-hidden', 'false'); }
function hideModal() { els.bookingModal.classList.remove('active'); els.bookingModal.setAttribute('aria-hidden', 'true'); pendingFlatId = null; }

function friendlyError(error, fallback) {
  if (!error) return fallback;
  if (error.code === 4001 || error.code === 'ACTION_REJECTED') return 'Transaction rejected in MetaMask.';
  if (error.reason) return error.reason;
  if (error.shortMessage) return error.shortMessage;
  if (/insufficient funds/i.test(error.message || '')) return 'Insufficient ETH for the booking and gas.';
  return fallback;
}

async function ensureSepolia() {
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId === CONFIG.chainId) return;
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CONFIG.chainId }] });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CONFIG.chainId, chainName: 'Sepolia Test Network', nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://rpc.sepolia.org'], blockExplorerUrls: [CONFIG.explorerBaseUrl] }] });
  }
}

async function verifyContract() {
  const code = await provider.getCode(CONFIG.contractAddress);
  if (code === '0x') throw new Error('No contract bytecode found at the configured address on Sepolia.');
}

async function connectWallet() {
  if (!window.ethereum) { setStatus('MetaMask is not installed. Install it to continue.'); return; }
  try {
    els.connect.disabled = true;
    setStatus('Connecting wallet…');
    await ensureSepolia();
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    contract = new ethers.Contract(CONFIG.contractAddress, abi, signer);
    await verifyContract();
    els.connect.textContent = shortAddress(userAddress);
    await refreshDashboard();
    await loadFlats();
    await loadActivity();
    setStatus('Wallet connected. You can browse and book available flats.');
  } catch (error) {
    setStatus(friendlyError(error, 'Unable to connect wallet.'));
  } finally { els.connect.disabled = false; }
}

async function refreshDashboard() {
  if (!provider || !userAddress) return;
  const [balance, owner, contractBalance] = await Promise.all([provider.getBalance(userAddress), contract.contractOwner(), contract.getContractBalance()]);
  els.wallet.textContent = shortAddress(userAddress);
  els.walletBalance.textContent = formatEth(balance);
  els.contractBalance.textContent = formatEth(contractBalance);
  els.contractOwner.textContent = shortAddress(owner);
  if (flatPrice !== null) els.flatPrice.textContent = formatEth(flatPrice);
}

async function loadFlats() {
  els.flats.innerHTML = '<div class="loading-card">Loading on-chain property inventory…</div>';
  try {
    totalFlats = Number(await contract.TOTAL_FLATS());
  } catch { totalFlats = CONFIG.totalFlatsFallback; }
  try { flatPrice = await contract.flatPrice(); } catch { flatPrice = null; }
  const results = [];
  const sampleLimit = Math.min(totalFlats, 100);
  for (let i = 0; i < sampleLimit; i += 1) {
    try {
      const detail = await contract.getFlatDetails(i);
      results.push({ id: Number(detail[0]), owner: detail[1], booked: detail[2] });
    } catch { /* ignore individual stale listings */ }
  }
  flatsCache = results;
  renderStats();
  renderFlats();
}

function renderStats() {
  const available = flatsCache.filter((flat) => !flat.booked).length;
  els.totalFlats.textContent = totalFlats;
  els.availableFlats.textContent = available;
  els.flatPrice.textContent = flatPrice === null ? '—' : formatEth(flatPrice);
}

function renderFlats() {
  const query = els.search.value.trim().toLowerCase();
  const filtered = flatsCache.filter((flat) => {
    const matchesQuery = !query || String(flat.id).includes(query);
    const matchesStatus = activeFilter === 'all' || (activeFilter === 'available' && !flat.booked) || (activeFilter === 'booked' && flat.booked);
    return matchesQuery && matchesStatus;
  });
  if (!filtered.length) { els.flats.innerHTML = '<div class="empty-card"><strong>No matching properties</strong><span>Try another search or filter.</span></div>'; return; }
  els.flats.innerHTML = filtered.map((flat) => `
    <article class="flat-card ${flat.booked ? 'booked' : ''}">
      <div class="flat-visual"><span>UNIT ${flat.id}</span><b>${flat.booked ? 'BOOKED' : 'AVAILABLE'}</b></div>
      <div class="flat-content"><span class="small-label">ON-CHAIN UNIT #${flat.id}</span><h3>Metaverse Residence ${flat.id}</h3><p>${flat.booked ? `Owned by ${shortAddress(flat.owner)}` : 'Available for direct on-chain booking.'}</p><div class="flat-footer"><strong>${flatPrice === null ? '—' : formatEth(flatPrice)}</strong><button class="book-btn" data-id="${flat.id}" ${flat.booked ? 'disabled' : ''}>${flat.booked ? 'Booked' : 'Book now'}</button></div></div>
    </article>`).join('');
  els.flats.querySelectorAll('.book-btn').forEach((button) => button.addEventListener('click', () => openBooking(Number(button.dataset.id))));
}

async function openBooking(flatId) {
  const flat = flatsCache.find((item) => item.id === flatId);
  if (!flat || flat.booked || flatPrice === null) return;
  pendingFlatId = flatId;
  els.bookingTitle.textContent = `Book Residence ${flatId}`;
  els.bookingPrice.textContent = formatEth(flatPrice);
  els.bookingStatus.textContent = '';
  els.confirmBooking.disabled = false;
  showModal();
}

async function confirmBooking() {
  if (pendingFlatId === null || !contract || flatPrice === null) return;
  try {
    els.confirmBooking.disabled = true;
    els.bookingStatus.textContent = 'Waiting for MetaMask confirmation…';
    const tx = await contract.bookFlat(pendingFlatId, { value: flatPrice });
    els.bookingStatus.textContent = 'Transaction submitted. Waiting for confirmation…';
    await tx.wait();
    els.bookingStatus.textContent = 'Booking confirmed on Sepolia.';
    setStatus(`Flat ${pendingFlatId} booked successfully.`);
    await Promise.all([refreshDashboard(), loadFlats(), loadActivity()]);
    setTimeout(hideModal, 900);
  } catch (error) {
    els.bookingStatus.textContent = friendlyError(error, 'Booking failed. No booking was confirmed.');
    els.confirmBooking.disabled = false;
  }
}

async function loadActivity() {
  if (!contract) return;
  try {
    const events = await contract.queryFilter(contract.filters.FlatBooked(), -5000, 'latest');
    if (!events.length) { els.activity.innerHTML = '<p class="muted">No booking events found in the recent block window.</p>'; return; }
    els.activity.innerHTML = events.slice(-10).reverse().map((event) => {
      const flatId = event.args[0]; const buyer = event.args[1]; const amount = event.args[2];
      return `<div class="activity-row"><div><strong>Flat ${flatId} booked</strong><span>${shortAddress(buyer)} · ${formatEth(amount)}</span></div><a href="${txUrl(event.transactionHash)}" target="_blank" rel="noopener noreferrer">View tx ↗</a></div>`;
    }).join('');
  } catch { els.activity.innerHTML = '<p class="muted">Activity is temporarily unavailable. Refresh to retry.</p>'; }
}

window.addEventListener('load', () => {
  els.connect.addEventListener('click', connectWallet);
  els.confirmBooking.addEventListener('click', confirmBooking);
  $('closeModal').addEventListener('click', hideModal);
  els.bookingModal.addEventListener('click', (event) => { if (event.target === els.bookingModal) hideModal(); });
  els.search.addEventListener('input', renderFlats);
  els.listingState.addEventListener('change', (event) => { activeFilter = event.target.value; renderFlats(); });
  $('refreshBtn').addEventListener('click', async () => { if (!contract) return; setStatus('Refreshing on-chain data…'); await Promise.all([refreshDashboard(), loadFlats(), loadActivity()]); setStatus('Data refreshed.'); });
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', () => window.location.reload());
    window.ethereum.on('chainChanged', () => window.location.reload());
  }
});
