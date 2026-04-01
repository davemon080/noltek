import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Job, UserProfile } from '../types';
import { supabaseService } from '../services/supabaseService';
import { useCurrency } from '../context/CurrencyContext';
import { convertFromUSD, convertToUSD, formatMoneyFromUSD } from '../utils/currency';

interface JobApplyProps {
  profile: UserProfile;
}

export default function JobApply({ profile }: JobApplyProps) {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const [job, setJob] = useState<Job | null>(null);
  const [content, setContent] = useState('');
  const [budget, setBudget] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    supabaseService
      .getJobById(jobId)
      .then((item) => {
        setJob(item);
        if (item) setBudget(Number(convertFromUSD(item.budget, currency).toFixed(2)));
      })
      .finally(() => setLoading(false));
  }, [currency, jobId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !jobId) return;
    setSubmitting(true);
    setError(null);
    try {
      await supabaseService.createProposal({
        freelancerUid: profile.uid,
        jobId,
        content,
        budget: Number(convertToUSD(budget, currency).toFixed(6)),
      });
      navigate('/jobs');
    } catch (err: any) {
      setError(err.message || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto p-6 text-sm text-gray-500">Loading application form...</div>;
  }

  if (!job) {
    return <div className="max-w-3xl mx-auto p-6 text-sm text-gray-500">Gig not found.</div>;
  }

  if (profile.role !== 'freelancer') {
    return <div className="max-w-3xl mx-auto p-6 text-sm text-gray-500">Only freelancers can apply.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Apply to Gig</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-200 p-6 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-1">Gig</p>
          <p className="text-lg font-bold text-gray-900">{job.title}</p>
          <p className="text-sm text-gray-500 mt-1">Posted budget: {formatMoneyFromUSD(job.budget, currency)}</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Application message</label>
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full min-h-[160px] px-4 py-3 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Explain why you're a strong fit and how you will deliver."
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Your proposed budget ({currency})</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(parseFloat(e.target.value))}
            className="w-full px-4 py-3 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !content.trim() || budget <= 0}
          className="w-full bg-teal-700 text-white font-bold py-3 rounded-2xl hover:bg-teal-800 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
}
