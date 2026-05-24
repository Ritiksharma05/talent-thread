'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

interface Props {
  coverMessage: string;
  jobTitle: string;
  jobSkills: string[];
  portfolioCount: number;
}

export default function AIScoreWidget({ coverMessage, jobTitle, jobSkills, portfolioCount }: Props) {
  const [score, setScore] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (coverMessage.length < 50) {
      setScore(null);
      setSuggestions([]);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const scoreApplication = httpsCallable(functions, 'scoreApplication');
        const result: any = await scoreApplication({
          coverMessage,
          jobTitle,
          jobSkills,
          portfolioCount
        });
        setScore(result.data.score);
        setSuggestions(result.data.suggestions);
      } catch (err) {
        console.error("AI Scoring failed:", err);
      } finally {
        setLoading(false);
      }
    }, 1200);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [coverMessage, portfolioCount]);

  const getColorClass = (s: number) => {
    if (s <= 40) return 'text-red-500 stroke-red-500';
    if (s <= 70) return 'text-amber-500 stroke-amber-500';
    return 'text-green-500 stroke-green-500';
  };

  return (
    <div className="bg-slate-50 border border-blue-100 rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <Sparkles size={40} className="text-blue-600" />
      </div>

      <div className="flex items-start gap-6">
        {/* Circular Progress */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="40" cy="40" r="36"
              className="stroke-slate-200"
              strokeWidth="6" fill="transparent"
            />
            {score !== null && (
              <circle
                cx="40" cy="40" r="36"
                className={`transition-all duration-1000 ${getColorClass(score)}`}
                strokeWidth="6" fill="transparent"
                strokeDasharray={226}
                strokeDashoffset={226 - (226 * score) / 100}
                strokeLinecap="round"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {loading ? (
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className={`text-xl font-black ${score !== null ? getColorClass(score).split(' ')[0] : 'text-slate-300'}`}>
                {score ?? '?'}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
            AI Application Match <Sparkles size={14} className="text-blue-600" />
          </h4>
          
          {score === null ? (
            <p className="text-xs text-slate-500 leading-relaxed italic">
              "Start writing to get your AI match score. A higher score increases your chances of getting viewed."
            </p>
          ) : (
            <ul className="space-y-2">
              {suggestions.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] font-medium text-slate-600 leading-tight">
                  {item.toLowerCase().includes('good') || item.toLowerCase().includes('great') ? (
                    <CheckCircle2 size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  )}
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
