'use client';

import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Clock, IndianRupee, ChevronRight, MessageSquare } from 'lucide-react';

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadApps() {
      if (!auth.currentUser) return;
      const q = query(
        collection(db, 'applications'),
        where('freelancerId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setApplications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }
    loadApps();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'accepted': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'shortlisted': return 'bg-blue-100 text-blue-700';
      case 'viewed': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  if (loading) return <div className="max-w-4xl mx-auto p-8 animate-pulse space-y-4"><div className="h-10 bg-slate-100 w-1/4 rounded"></div><div className="h-32 bg-slate-100 rounded-xl"></div><div className="h-32 bg-slate-100 rounded-xl"></div></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-black text-slate-900 mb-8">My Applications</h1>

      {applications.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <p className="text-slate-500 font-medium">You haven't applied to any jobs yet.</p>
          <button onClick={() => router.push('/find-work')} className="mt-4 text-blue-600 font-bold hover:underline">
            Browse Jobs →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div key={app.id} className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-blue-200 transition group shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition">{app.jobSnapshot.title}</h3>
                  <p className="text-sm text-slate-500 font-medium">{app.jobSnapshot.category}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusColor(app.status)}`}>
                  {app.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-6 text-sm text-slate-600 mb-6">
                <div className="flex items-center gap-2">
                  <IndianRupee size={14} className="text-slate-400" />
                  <span className="font-bold">₹{Number(app.proposedRate).toLocaleString()}</span>
                  <span className="text-xs text-slate-400 uppercase">({app.rateType})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-slate-400" />
                  <span>{app.proposedTimeline}</span>
                </div>
                <div className="ml-auto text-xs text-slate-400 font-medium">
                  Applied {new Date(app.createdAt?.toDate()).toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-500">AI</div>
                  <span className="text-xs font-bold text-slate-700">Match Score: {app.aiScore}%</span>
                </div>
                <button 
                  onClick={() => router.push(`/messages/${app.conversationId}`)}
                  className="flex items-center gap-2 text-blue-600 font-bold text-sm hover:gap-3 transition-all"
                >
                  <MessageSquare size={16} /> View Conversation <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
