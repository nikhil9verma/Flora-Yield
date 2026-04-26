import { useState, useEffect } from 'react';
import { fetchSuppliers } from '../api/client';
import { FiPhone, FiMapPin, FiFilter, FiCheckCircle, FiAlertCircle, FiTruck } from 'react-icons/fi';
import { GiFertilizerBag, GiChemicalDrop, GiSprout } from 'react-icons/gi';

const CATEGORIES = ['All', 'Fertilizer', 'Manure', 'Pesticide', 'Machinery'];

const categoryMeta = {
  Fertilizer: { icon: GiFertilizerBag, color: 'green', bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/20' },
  Manure: { icon: GiSprout, color: 'earth', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/20' },
  Pesticide: { icon: GiChemicalDrop, color: 'red', bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/20' },
  Machinery: { icon: FiTruck, color: 'blue', bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/20' },
};

const SkeletonCard = () => (
  <div className="glass-card p-5 animate-pulse space-y-3">
    <div className="flex gap-3 items-center">
      <div className="w-12 h-12 rounded-xl bg-white/10 shimmer" />
      <div className="space-y-2 flex-1">
        <div className="h-4 bg-white/10 shimmer rounded w-2/3" />
        <div className="h-3 bg-white/5 shimmer rounded w-1/3" />
      </div>
    </div>
    <div className="h-3 bg-white/5 shimmer rounded w-full" />
    <div className="h-8 bg-white/5 shimmer rounded" />
  </div>
);

export default function SupplierBoard() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    fetchSuppliers()
      .then(setSuppliers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    activeCategory === 'All' ? suppliers : suppliers.filter((s) => s.category === activeCategory);

  return (
    <section id="supplier-board">
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-header mb-0">
          <span className="p-2 bg-blue-500/20 rounded-xl"><GiFertilizerBag className="text-blue-400" /></span>
          Input Sourcing Board
        </h2>
        {!loading && (
          <span className="text-xs text-slate-400">{filtered.length} suppliers</span>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <FiFilter className="text-slate-400 text-sm shrink-0" />
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
              activeCategory === cat
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'glass-card text-slate-400 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {error && (
        <div className="glass-card p-4 border-red-500/30 bg-red-500/5 flex items-center gap-3 text-red-400 mb-4">
          <FiAlertCircle className="text-xl shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading
          ? [...Array(5)].map((_, i) => <SkeletonCard key={i} />)
          : filtered.map((supplier) => {
              const meta = categoryMeta[supplier.category] || categoryMeta.Fertilizer;
              const Icon = meta.icon;
              return (
                <div key={supplier.id} className="glass-card-hover p-5 animate-slide-up group">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`p-3 rounded-xl ${meta.bg} shrink-0`}>
                      <Icon className={`${meta.text} text-xl`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-sm truncate">{supplier.businessName}</h3>
                      <span className={`status-badge ${meta.bg} ${meta.text} border ${meta.border} mt-1.5`}>
                        {supplier.category}
                      </span>
                    </div>
                    {supplier.verifiedStatus && (
                      <FiCheckCircle className="text-brand-400 text-lg shrink-0" title="Verified Supplier" />
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2 text-slate-400">
                      <FiMapPin className="mt-0.5 shrink-0 text-slate-500" />
                      <span className="leading-snug">{supplier.address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <FiPhone className="shrink-0 text-slate-500" />
                      <span>{supplier.contactNumber}</span>
                    </div>
                  </div>

                  <a
                    href={`tel:${supplier.contactNumber}`}
                    className="mt-4 w-full block text-center py-2 rounded-xl border border-blue-500/30 text-blue-400 text-xs font-semibold hover:bg-blue-500/10 transition-all duration-200"
                  >
                    📞 Contact Supplier
                  </a>
                </div>
              );
            })}
      </div>
    </section>
  );
}
