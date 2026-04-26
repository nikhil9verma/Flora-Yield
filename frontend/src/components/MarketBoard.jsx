import { useState, useEffect } from 'react';
import { fetchMandiPrices, fetchBuyers } from '../api/client';
import { FiTrendingUp, FiMail, FiPhone, FiAlertCircle, FiPackage } from 'react-icons/fi';
import { GiWheat } from 'react-icons/gi';

const priceColor = (price) => {
  if (price >= 400) return 'text-purple-400';
  if (price >= 200) return 'text-brand-400';
  return 'text-slate-300';
};

const SkeletonRow = () => (
  <div className="flex items-center gap-3 p-3 animate-pulse">
    <div className="h-4 bg-white/10 shimmer rounded flex-1" />
    <div className="h-4 bg-white/10 shimmer rounded w-20" />
    <div className="h-4 bg-white/10 shimmer rounded w-16" />
  </div>
);

const SkeletonBuyerCard = () => (
  <div className="glass-card p-5 animate-pulse space-y-3">
    <div className="h-5 bg-white/10 shimmer rounded w-2/3" />
    <div className="h-3 bg-white/5 shimmer rounded w-1/3" />
    <div className="grid grid-cols-2 gap-2">
      {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-white/5 shimmer rounded-lg" />)}
    </div>
    <div className="h-9 bg-white/5 shimmer rounded-xl" />
  </div>
);

export default function MarketBoard() {
  const [prices, setPrices] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [loadingBuyers, setLoadingBuyers] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMandiPrices()
      .then(setPrices)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingPrices(false));

    fetchBuyers()
      .then(setBuyers)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingBuyers(false));
  }, []);

  return (
    <section id="market-board">
      <h2 className="section-header">
        <span className="p-2 bg-purple-500/20 rounded-xl"><FiTrendingUp className="text-purple-400" /></span>
        B2B Market & Mandi Prices
      </h2>

      {error && (
        <div className="glass-card p-4 border-red-500/30 bg-red-500/5 flex items-center gap-3 text-red-400 mb-4">
          <FiAlertCircle className="text-xl shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── LEFT: Live Mandi Prices ── */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <GiWheat className="text-earth-400" /> Live Mandi Prices — Himachal Pradesh
          </h3>
          <div className="glass-card overflow-hidden">
            <div className="grid grid-cols-4 gap-2 px-4 py-2.5 bg-white/5 border-b border-white/10 text-xs text-slate-400 font-semibold uppercase tracking-wide">
              <span className="col-span-2">Commodity</span>
              <span className="text-right">Modal</span>
              <span className="text-right">Range</span>
            </div>
            <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
              {loadingPrices
                ? [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
                : prices.map((p, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-4 gap-2 px-4 py-3 hover:bg-white/5 transition-colors animate-fade-in group"
                    >
                      <div className="col-span-2">
                        <p className="text-sm font-medium text-white">{p.commodity}</p>
                        <p className="text-xs text-slate-500">{p.market}</p>
                      </div>
                      <p className={`text-right font-bold text-sm ${priceColor(p.modalPrice)}`}>
                        ₹{p.modalPrice}
                        <span className="text-xs font-normal text-slate-500 block">/kg</span>
                      </p>
                      <div className="text-right text-xs text-slate-400">
                        <p className="text-green-400">↑ ₹{p.maxPrice}</p>
                        <p className="text-red-400">↓ ₹{p.minPrice}</p>
                      </div>
                    </div>
                  ))}
            </div>
            <div className="px-4 py-2 border-t border-white/5 text-xs text-slate-500 text-right">
              Source: Agmarknet · Updated {new Date().toLocaleDateString('en-IN')}
            </div>
          </div>
        </div>

        {/* ── RIGHT: B2B Buyer Leads ── */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <FiPackage className="text-purple-400" /> Direct Buyer Leads
          </h3>
          <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-1">
            {loadingBuyers
              ? [...Array(3)].map((_, i) => <SkeletonBuyerCard key={i} />)
              : buyers.map((buyer) => (
                  <div key={buyer.id} className="glass-card-hover p-5 animate-slide-up border-purple-500/10">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-white">{buyer.companyName}</h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="status-badge bg-purple-500/15 text-purple-300 border border-purple-500/20 text-xs">
                            🌿 {buyer.targetCrop}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-purple-400">₹{buyer.offeredPricePerKg}/kg</p>
                        <p className="text-xs text-slate-400">Offered Rate</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="glass-card p-2.5 text-center">
                        <p className="text-brand-400 font-bold text-sm">
                          {buyer.requiredQuantityKg >= 1000
                            ? `${(buyer.requiredQuantityKg / 1000).toFixed(1)}T`
                            : `${buyer.requiredQuantityKg}kg`}
                        </p>
                        <p className="text-xs text-slate-500">Required Qty</p>
                      </div>
                      <div className="glass-card p-2.5 text-center">
                        <p className="text-earth-400 font-bold text-sm">
                          ₹{(buyer.requiredQuantityKg * buyer.offeredPricePerKg / 1000).toFixed(0)}K
                        </p>
                        <p className="text-xs text-slate-500">Deal Value</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <a
                        href={`mailto:${buyer.contactEmail}?subject=Re: ${buyer.targetCrop} Supply Enquiry`}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white text-xs font-bold transition-all duration-200 hover:shadow-lg hover:shadow-purple-900/30 active:scale-95"
                      >
                        <FiMail /> Email Now
                      </a>
                      <a
                        href={`tel:${buyer.contactPhone}`}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-purple-500/30 text-purple-400 text-xs font-bold hover:bg-purple-500/10 transition-all duration-200"
                      >
                        <FiPhone /> Call
                      </a>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </section>
  );
}
