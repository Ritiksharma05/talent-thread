'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { BadgeCheck, Calendar, Briefcase, MessageCircle } from 'lucide-react';

interface Props {
  clientId: string;
}

export default function ClientCard({ clientId }: Props) {
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClient() {
      const docSnap = await getDoc(doc(db, 'users', clientId));
      if (docSnap.exists()) {
        setClient(docSnap.data());
      }
      setLoading(false);
    }
    loadClient();
  }, [clientId]);

  if (loading) return <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl animate-pulse h-48"></div>;
  if (!client) return null;

  return (
    <div className="p-6 border border-slate-200 rounded-2xl bg-white shadow-sm">
      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">About the Client</h4>
      
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-xl border border-blue-100 overflow-hidden">
          {client.photoURL ? (
            <img src={client.photoURL} alt={client.displayName} className="w-full h-full object-cover" />
          ) : (
            (client.displayName || 'C').charAt(0)
          )}
        </div>
        <div>
          <div className="flex items-center gap-1">
            <h5 className="font-bold text-slate-900 leading-none">{client.displayName || 'Verified Client'}</h5>
            {client.isVerified && <BadgeCheck size={16} className="text-blue-500" />}
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Member since {new Date(client.createdAt).getFullYear()}
          </p>
        </div>
      </div>

      <div className="space-y-4 pt-6 border-t border-slate-100">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Briefcase size={14} /> <span>Jobs Posted</span>
          </div>
          <span className="font-bold text-slate-700">{client.jobsPostedCount || 0}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <MessageCircle size={14} /> <span>Response Rate</span>
          </div>
          <span className="font-bold text-slate-700">{client.responseRate || '100%'}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Calendar size={14} /> <span>Avg. Hire Rate</span>
          </div>
          <span className="font-bold text-slate-700">{client.hireRate || '85%'}</span>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-100">
        <button className="text-blue-600 text-[11px] font-black uppercase tracking-wider hover:text-blue-700 transition">
          View Profile & Past Reviews →
        </button>
      </div>
    </div>
  );
}
