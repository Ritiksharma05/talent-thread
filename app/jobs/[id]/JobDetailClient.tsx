'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Bookmark, MapPin, Clock, Briefcase, IndianRupee, ChevronRight, AlertCircle } from 'lucide-react';
import ApplyDrawer from '@/components/jobs/ApplyDrawer';
import ClientCard from '@/components/jobs/ClientCard';
import { Job } from '@/types/job';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

interface Props {
  job: Job;
}

export default function JobDetailClient({ job }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isClosed = job.status === 'closed';

  useEffect(() => {
    if (searchParams.get('apply') === 'true') setIsApplyOpen(true);
    checkStatus();
  }, [job.id, searchParams]);

  async function checkStatus() {
    if (!auth.currentUser) return;
    
    // Check if saved
    const savedDoc = await getDoc(doc(db, 'users', auth.currentUser.uid, 'savedJobs', job.id));
    setIsSaved(savedDoc.exists());

    // Check if applied
    const appQuery = query(
      collection(db, 'applications'),
      where('jobId', '==', job.id),
      where('freelancerId', '==', auth.currentUser.uid)
    );
    const appSnap = await getDocs(appQuery);
    if (!appSnap.empty) {
      setApplication(appSnap.docs[0].data());
    }
    setLoading(false);
  }

  async function toggleSave() {
    if (!auth.currentUser) return router.push('/login');
    const savedRef = doc(db, 'users', auth.currentUser.uid, 'savedJobs', job.id);
    if (isSaved) {
      await deleteDoc(savedRef);
    } else {
      await setDoc(savedRef, { createdAt: new Date().toISOString() });
    }
    setIsSaved(!isSaved);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex mb-6 text-sm text-slate-500 items-center gap-2">
        <span className="hover:text-blue-600 cursor-pointer" onClick={() => router.push('/find-work')}>Find Work</span>
        <ChevronRight size={14} />
        <span>Job Detail</span>
      </nav>

      {isClosed && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <p className="font-medium">This job is no longer accepting applications.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-8">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h1 className="text-3xl font-extrabold text-slate-900">{job.title}</h1>
            <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold uppercase rounded-full">
              {job.discipline?.[0] || job.category}
            </span>
          </div>

          <div className="text-slate-500 text-sm mb-8">
            {job.applicationCount || 0} applicants · Posted {formatDistanceToNow(new Date(job.createdAt))} ago
          </div>

          {/* Meta Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-slate-50 rounded-2xl mb-8 border border-slate-100">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Budget</span>
              <div className="flex items-center gap-2 font-semibold text-slate-700">
                <IndianRupee size={16} className="text-blue-600" />
                <span>{job.budgetMin.toLocaleString()} - {job.budgetMax.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Timeline</span>
              <div className="flex items-center gap-2 font-semibold text-slate-700">
                <Clock size={16} className="text-blue-600" />
                <span>{job.timeline}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Level</span>
              <div className="flex items-center gap-2 font-semibold text-slate-700">
                <Briefcase size={16} className="text-blue-600" />
                <span className="capitalize">{job.experienceLevel}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Type</span>
              <div className="flex items-center gap-2 font-semibold text-slate-700">
                <MapPin size={16} className="text-blue-600" />
                <span className="capitalize">{job.workType}</span>
              </div>
            </div>
          </div>

          <div className="prose prose-slate max-w-none mb-10">
            <h3 className="text-lg font-bold mb-4">Job Description</h3>
            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{job.description}</p>
          </div>

          <div className="mb-10">
            <h3 className="text-lg font-bold mb-4">Required Skills</h3>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((skill) => (
                <span key={skill} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {job.attachments && job.attachments.length > 0 && (
            <div className="mb-10">
              <h3 className="text-lg font-bold mb-4">Attachments</h3>
              <div className="flex flex-col gap-3">
                {job.attachments.map((file, i) => (
                  <a key={i} href={file} target="_blank" className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition">
                    <span className="w-10 h-10 bg-blue-50 text-blue-600 flex items-center justify-center rounded-lg font-bold">PDF</span>
                    <span className="text-sm font-medium text-slate-700 truncate">{file.split('/').pop()}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 flex flex-col gap-6">
            <div className="p-6 border border-slate-200 rounded-2xl shadow-sm bg-white">
              {application ? (
                <button 
                  onClick={() => router.push(`/messages/${application.conversationId}`)}
                  className="w-full py-4 bg-slate-100 text-slate-700 font-bold rounded-xl mb-4 flex items-center justify-center gap-2"
                >
                  You've applied · View Application <ChevronRight size={18} />
                </button>
              ) : (
                <button 
                  disabled={isClosed}
                  onClick={() => setIsApplyOpen(true)}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl mb-4 transition"
                >
                  {isClosed ? 'Job Closed' : 'Apply Now'}
                </button>
              )}

              <button 
                onClick={toggleSave}
                className="w-full py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 transition"
              >
                <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} className={isSaved ? 'text-blue-600' : ''} />
                {isSaved ? 'Saved' : 'Save Job'}
              </button>

              <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Deadline</p>
                  <p className="text-sm font-bold text-slate-700">{formatDistanceToNow(new Date(job.deadline))} left</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Applicants</p>
                  <p className="text-sm font-bold text-slate-700">{job.applicationCount || 0}</p>
                </div>
              </div>
            </div>

            <ClientCard clientId={job.clientId} />
          </div>
        </div>
      </div>

      <ApplyDrawer 
        isOpen={isApplyOpen} 
        onClose={() => setIsApplyOpen(false)} 
        job={job} 
      />
    </div>
  );
}
