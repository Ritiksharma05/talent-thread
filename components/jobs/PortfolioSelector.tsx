'use client';

import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Plus, Check } from 'lucide-react';
import Link from 'next/link';

interface PortfolioItem {
  id: string;
  title: string;
  thumbnail: string;
  category: string;
}

interface Props {
  selected: string[];
  onToggle: (id: string) => void;
}

export default function PortfolioSelector({ selected, onToggle }: Props) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPortfolio() {
      if (!auth.currentUser) return;
      const q = query(collection(db, 'users', auth.currentUser.uid, 'portfolio'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PortfolioItem[]);
      setLoading(false);
    }
    loadPortfolio();
  }, []);

  if (loading) return <div className="grid grid-cols-3 gap-3 animate-pulse"><div className="aspect-square bg-slate-100 rounded-lg"></div><div className="aspect-square bg-slate-100 rounded-lg"></div><div className="aspect-square bg-slate-100 rounded-lg"></div></div>;

  if (items.length === 0) {
    return (
      <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center">
        <p className="text-sm text-slate-500 mb-4">Your portfolio is empty.</p>
        <Link href="/portfolio" className="text-blue-600 font-bold text-sm hover:underline flex items-center justify-center gap-1">
          Upload New Work <Plus size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => {
        const isSelected = selected.includes(item.id);
        return (
          <div 
            key={item.id}
            onClick={() => onToggle(item.id)}
            className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all group ${isSelected ? 'border-blue-600 ring-4 ring-blue-50' : 'border-transparent'}`}
          >
            <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent p-2 flex flex-col justify-end">
              <span className="text-[10px] font-black text-white truncate leading-tight">{item.title}</span>
              <span className="text-[8px] text-white/80 font-bold uppercase tracking-wide">{item.category}</span>
            </div>
            {isSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg">
                <Check size={12} strokeWidth={4} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
