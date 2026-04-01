import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Briefcase, Clock, UserCircle, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Job, UserProfile } from '../types';
import { supabaseService } from '../services/supabaseService';
import { useCurrency } from '../context/CurrencyContext';
import { formatMoneyFromUSD } from '../utils/currency';
import CachedImage from './CachedImage';

interface JobDetailsProps {
  profile: UserProfile;
}

export default function JobDetails({ profile }: JobDetailsProps) {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const [job, setJob] = useState<Job | null>(null);
  const [client, setClient] = useState<UserProfile | null>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) return;
    let active = true;

    Promise.all([supabaseService.getJobById(jobId), supabaseService.hasAppliedToJob(jobId, profile.uid)])
      .then(async ([jobItem, alreadyApplied]) => {
        if (!active) return;
        setJob(jobItem);
        setHasApplied(alreadyApplied);
        if (jobItem) {
          const clientProfile = await supabaseService.getUserProfile(jobItem.clientUid);
          if (active) setClient(clientProfile);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [jobId, profile.uid]);

  if (loading) {
    return <div className="max-w-4xl mx-auto p-6 text-sm text-gray-500">Loading gig details...</div>;
  }

  if (!job) {
    return <div className="max-w-4xl mx-auto p-6 text-sm text-gray-500">Gig not found.</div>;
  }

  const isOwner = job.clientUid === profile.uid;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Gig Details</h1>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-teal-600 mb-2">{job.category}</p>
          <h2 className="text-2xl font-bold text-gray-900">{job.title}</h2>
        </div>
        {isOwner && (
          <Link
            to={`/manage-gigs?jobId=${job.id}`}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700"
            title="Manage this gig"
          >
            <Settings size={18} />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 bg-gray-50 rounded-xl text-sm font-semibold text-gray-700">
          Budget: {formatMoneyFromUSD(job.budget, currency)}
        </div>
        <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-700 flex items-center gap-2">
          <MapPin size={15} /> {job.isRemote ? 'Remote' : 'On-site'}
        </div>
        <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-700 flex items-center gap-2">
          <Clock size={15} /> {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
        </div>
      </div>

      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{job.description}</p>

      {client && (
        <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60">
          <p className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">Posted by</p>
          <Link to={`/profile/${client.uid}`} className="flex items-center gap-3 hover:opacity-80">
            <CachedImage
              src={client.photoURL}
              alt={client.displayName}
              wrapperClassName="w-12 h-12 rounded-xl"
              imgClassName="w-full h-full rounded-xl object-cover"
            />
            <div>
              <p className="text-sm font-bold text-gray-900">{client.displayName}</p>
              <p className="text-xs text-gray-500 capitalize">{client.role}</p>
            </div>
          </Link>
        </div>
      )}

      {!isOwner && profile.role === 'freelancer' && (
        <div className="flex flex-wrap gap-3">
          <Link
            to={`/jobs/${job.id}/apply`}
            className={`px-6 py-3 rounded-xl font-bold text-sm ${
              hasApplied ? 'bg-gray-200 text-gray-600 pointer-events-none' : 'bg-teal-700 text-white hover:bg-teal-800'
            }`}
          >
            {hasApplied ? 'Application Submitted' : 'Apply for Gig'}
          </Link>
          <Link
            to={`/messages?uid=${job.clientUid}`}
            className="px-6 py-3 rounded-xl font-bold text-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Message Client
          </Link>
        </div>
      )}

      {!isOwner && profile.role !== 'freelancer' && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
          Only freelancer accounts can apply to gigs.
        </div>
      )}
    </div>
  );
}
