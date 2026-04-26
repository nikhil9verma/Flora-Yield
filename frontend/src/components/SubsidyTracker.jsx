import { useState, useEffect } from 'react';
import { fetchSchemes } from '../api/client';
import { FiExternalLink, FiAlertCircle, FiAward } from 'react-icons/fi';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';

const categoryColors = {
  'Ministry of Agriculture & Farmers Welfare': 'brand',
  'HP State Government': 'earth',
  'AYUSH Ministry': 'purple',
};

const SkeletonCard = () => (
  <div className="glass-card p-5 animate-pulse">
    <div className="h-4 bg-white/10 shimmer rounded-md w-3/4 mb-3" />
    <div className="h-3 bg-white/5 shimmer rounded-md w-1/2 mb-4" />
    <div className="h-10 bg-white/5 shimmer rounded-md w-full mb-3" />
    <div className="h-3 bg-white/5 shimmer rounded-md w-2/3" />
  </div>
);

export default function SubsidyTracker() {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    fetchSchemes()
      .then(setSchemes)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const ministries = ['All', ...new Set(schemes.map((s) => s.ministry).filter(Boolean))];
  const filtered = filter === 'All' ? schemes : schemes.filter((s) => s.ministry === filter);

  return (
    <section id="subsidy-tracker">
      <h2 className="section-header">
        <span className="p-2 bg-earth-500/20 rounded-xl"><FiAward className="text-earth-400" /></span>
        Subsidy Tracker
      </h2>

      {/* Filter Pills */}
      {!loading && !error && (
        <div className="flex flex-wrap gap-2 mb-5">
          {ministries.map((m) => (
            <button
              key={m}
              onClick={() => setFilter(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                filter === m
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-900/40'
                  : 'glass-card text-slate-400 hover:text-white'
              }`}
            >
              {m === 'All' ? 'All Schemes' : m?.length > 30 ? m.slice(0, 28) + '...' : m || 'Unknown'}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="glass-card p-4 border-red-500/30 bg-red-500/5 flex items-center gap-3 text-red-400 mb-4">
          <FiAlertCircle className="text-xl shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading
          ? [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
          : filtered.map((scheme, i) => {
              const color = categoryColors[scheme.ministry] || 'slate';
              return (
                <div key={i} className="glass-card-hover p-5 animate-fade-in group">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg bg-${color === 'purple' ? 'purple' : color === 'earth' ? 'earth' : 'brand'}-500/15 shrink-0`}>
                      <HiOutlineOfficeBuilding className={`text-${color === 'purple' ? 'purple' : color === 'earth' ? 'earth' : 'brand'}-400 text-lg`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm leading-snug">{scheme.schemeName}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{scheme.ministry}</p>
                    </div>
                  </div>

                  <div className="glass-card p-3 mb-3">
                    <p className="text-xs text-slate-400 uppercase tracking-widest mb-1 font-semibold">💰 Benefit</p>
                    <p className="text-sm text-brand-300 font-medium">{scheme.benefit}</p>
                  </div>

                  <p className="text-xs text-slate-400 mb-3">
                    <span className="font-semibold text-slate-300">Eligibility: </span>{scheme.eligibility}
                  </p>

                  {scheme.applyLink && (
                    <a
                      href={scheme.applyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-semibold group-hover:underline transition-colors"
                    >
                      Apply Online <FiExternalLink />
                    </a>
                  )}
                </div>
              );
            })}
      </div>
    </section>
  );
}
