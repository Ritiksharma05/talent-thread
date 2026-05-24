'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Image, Clock, Send, Save, Info } from 'lucide-react';
import AIScoreWidget from './AIScoreWidget';
import PortfolioSelector from './PortfolioSelector';
import { auth, db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { useRouter } from 'next/navigation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  job: any;
}

export default function ApplyDrawer({ isOpen, onClose, job }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [coverMessage, setCoverMessage] = useState('');
  const [selectedPortfolio, setSelectedPortfolio] = useState<string[]>([]);
  const [proposedRate, setProposedRate] = useState<number>(job.budgetMin);
  const [rateType, setRateType] = useState(job.budgetType);
  const [timeline, setTimeline] = useState('1 week');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Draft logic
  useEffect(() => {
    const draft = localStorage.getItem(`apply_draft_${job.id}`);
    if (draft) {
      const data = JSON.parse(draft);
      setCoverMessage(data.coverMessage || '');
      setProposedRate(data.proposedRate || job.budgetMin);
    }
  }, [job.id]);

  function saveDraft() {
    localStorage.setItem(`apply_draft_${job.id}`, JSON.stringify({
      coverMessage,
      proposedRate,
      rateType,
      timeline
    }));
    alert("Draft saved locally.");
  }

  async function handleSubmit() {
    if (!auth.currentUser) return;
    setIsSubmitting(true);
    
    try {
      const submitApplication = httpsCallable(functions, 'submitApplication');
      const result: any = await submitApplication({
        jobId: job.id,
        coverMessage,
        proposedRate,
        rateType,
        proposedTimeline: timeline,
        portfolioItems: selectedPortfolio
      });

      localStorage.removeItem(`apply_draft_${job.id}`);
      router.push(`/messages/${result.data.conversationId}`);
    } catch (err: any) {
      alert(err.message || "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Drawer */}
      <div className="relative w-full max-w-[560px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Apply for Job</h2>
            <p className="text-xs text-slate-500 mt-1 truncate max-w-[400px]">{job.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-10 pb-32">
          {/* Section 1: Cover Message */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Send size={16} className="text-blue-600" /> Cover Message
              </label>
              <span className={`text-[11px] font-bold ${coverMessage.length < 50 ? 'text-slate-400' : 'text-green-600'}`}>
                {coverMessage.length} / 2000 chars
              </span>
            </div>
            <textarea
              value={coverMessage}
              onChange={(e) => setCoverMessage(e.target.value)}
              placeholder="Introduce yourself and explain why you're a great fit — this becomes your first message to the client."
              className="w-full h-48 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm leading-relaxed"
              maxLength={2000}
            />
            <div className="flex flex-wrap gap-2 mt-3">
              <button 
                onClick={() => setCoverMessage(prev => prev + " I have extensive experience in similar projects...")}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] font-bold rounded-lg transition"
              >
                + Add experience note
              </button>
              <button 
                onClick={() => setCoverMessage(prev => prev + " I'd like to ask a few clarifying questions about the scope...")}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] font-bold rounded-lg transition"
              >
                + Ask about scope
              </button>
            </div>
          </section>

          {/* AI Score Widget */}
          <AIScoreWidget 
            coverMessage={coverMessage} 
            jobTitle={job.title} 
            jobSkills={job.skills} 
            portfolioCount={selectedPortfolio.length} 
          />

          {/* Section 2: Portfolio Selector */}
          <section>
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
              <Image size={16} className="text-blue-600" /> Select Portfolio Pieces
            </label>
            <PortfolioSelector 
              selected={selectedPortfolio} 
              onToggle={(id) => {
                if (selectedPortfolio.includes(id)) {
                  setSelectedPortfolio(selectedPortfolio.filter(i => i !== id));
                } else if (selectedPortfolio.length < 5) {
                  setSelectedPortfolio([...selectedPortfolio, id]);
                }
              }} 
            />
            <p className="text-[11px] text-slate-400 mt-2 font-medium">Select up to 5 pieces to showcase your relevant work.</p>
          </section>

          {/* Section 3: Rate & Timeline */}
          <section>
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
              <Clock size={16} className="text-blue-600" /> Terms & Delivery
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Proposed Rate (₹)</span>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400 font-bold">₹</span>
                  <input 
                    type="number"
                    value={proposedRate}
                    onChange={(e) => setProposedRate(Number(e.target.value))}
                    className="w-full p-3 pl-8 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                  />
                </div>
                {(proposedRate < job.budgetMin || proposedRate > job.budgetMax) && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-bold">
                    <Info size={12} /> Outside client budget range
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Est. Timeline</span>
                <select 
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none bg-white font-bold text-slate-700 appearance-none"
                >
                  <option>3 days</option>
                  <option>1 week</option>
                  <option>2 weeks</option>
                  <option>1 month</option>
                  <option>Custom</option>
                </select>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 sticky bottom-0 z-10 flex gap-4">
          <button 
            onClick={saveDraft}
            className="flex-1 py-4 border border-slate-200 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2 bg-white"
          >
            <Save size={18} /> Save Draft
          </button>
          <button 
            disabled={coverMessage.length < 50 || proposedRate <= 0 || isSubmitting}
            onClick={handleSubmit}
            className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-blue-200"
          >
            {isSubmitting ? 'Sending...' : 'Send Application'} <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
