import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/firebase-admin'; // Assume admin SDK setup for server-side
import JobDetailClient from './JobDetailClient';
import { Job } from '@/types/job';

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const job = await getJob(params.id);
  return {
    title: job ? `${job.title} | Talent Thread` : 'Job Not Found',
  };
}

async function getJob(id: string): Promise<Job | null> {
  const doc = await db.collection('projects').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Job;
}

export default async function JobPage({ params }: PageProps) {
  const job = await getJob(params.id);

  if (!job) {
    notFound();
  }

  return (
    <main className="min-height-screen bg-white">
      <JobDetailClient job={job} />
    </main>
  );
}
