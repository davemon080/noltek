import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, CircleDollarSign, Clock3, RefreshCcw, UserRound } from 'lucide-react';
import { ActiveGig, UserProfile } from '../types';
import { supabaseService } from '../services/supabaseService';
import { formatMoneyFromUSD } from '../utils/currency';
import { useCurrency } from '../context/CurrencyContext';
import { useConfirmDialog } from './ConfirmDialog';
import CachedImage from './CachedImage';

interface ActiveGigsProps {
  profile: UserProfile;
}

export default function ActiveGigs({ profile }: ActiveGigsProps) {
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [gigs, setGigs] = React.useState<ActiveGig[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [isApprovedCompany, setIsApprovedCompany] = React.useState<boolean | null>(profile.role === 'client' ? true : null);

  React.useEffect(() => {
    if (profile.role === 'client') {
      setIsApprovedCompany(true);
      return;
    }
    supabaseService
      .getMyCompanyPartnerRequest(profile.uid)
      .then((request) => setIsApprovedCompany(request?.status === 'approved'))
      .catch(() => setIsApprovedCompany(false));
  }, [profile.role, profile.uid]);

  const isClientView = profile.role === 'client' || isApprovedCompany === true;

  React.useEffect(() => {
    if (isApprovedCompany === null) return;
    const handleData = (items: ActiveGig[]) => {
      setGigs(items);
      setLoading(false);
      setError(null);
    };

    const handleError = (nextError: any) => {
      setError(nextError?.message || 'Failed to load active gigs.');
      setLoading(false);
    };

    const unsubscribe = isClientView
      ? supabaseService.subscribeToClientActiveGigs(profile.uid, handleData, handleError)
      : supabaseService.subscribeToFreelancerActiveGigs(profile.uid, handleData, handleError);

    return () => unsubscribe();
  }, [isApprovedCompany, isClientView, profile.uid]);

  const handleRevoke = async (gig: ActiveGig) => {
    const confirmed = await confirm({
      title: 'Revoke this assignment?',
      description: 'The freelancer will lose this active gig and the job will return to the public jobs page.',
      confirmLabel: 'Revoke Gig',
      tone: 'danger',
    });
    if (!confirmed) return;

    setRevokingId(gig.proposal.id);
    try {
      await supabaseService.updateProposalStatus(gig.proposal.id, 'pending');
    } catch (nextError: any) {
      setError(nextError?.message || 'Failed to revoke gig assignment.');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/settings')} className="rounded-full p-2 hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Active Gigs</h1>
          <p className="text-sm text-gray-500">
            {isClientView
              ? 'Track the freelancers currently assigned to your gigs.'
              : 'See the gigs you have been approved for and jump back into work quickly.'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Active gigs" value={gigs.length} />
        <SummaryCard
          label={isClientView ? 'Assigned freelancers' : 'Client approvals'}
          value={gigs.length}
        />
        <SummaryCard
          label="Open value"
          value={
            gigs.length > 0
              ? formatMoneyFromUSD(gigs.reduce((sum, gig) => sum + (gig.proposal.budget || gig.job.budget || 0), 0), currency)
              : formatMoneyFromUSD(0, currency)
          }
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          Loading active gigs...
        </div>
      ) : gigs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <Briefcase size={28} />
          </div>
          <h2 className="mt-4 text-xl font-bold text-gray-900">No active gigs yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            {isClientView
              ? 'Accept a freelancer from Manage Gigs to move the job into your active workspace.'
              : 'Once a client approves your proposal, the gig will appear here automatically.'}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link to={isClientView ? '/manage-gigs' : '/jobs'} className="rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800">
              {isClientView ? 'Open Manage Gigs' : 'Browse Jobs'}
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {gigs.map((gig) => {
            const counterpart = isClientView ? gig.freelancer : gig.client;
            const amount = gig.proposal.budget || gig.job.budget;
            return (
              <div key={gig.proposal.id} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                        <Clock3 size={12} />
                        Active assignment
                      </div>
                      <h2 className="mt-3 text-xl font-bold text-gray-900">{gig.job.title}</h2>
                      <p className="mt-1 text-sm text-gray-500">{gig.job.category}</p>
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm">
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2 font-semibold text-gray-700">
                        <CircleDollarSign size={16} className="text-emerald-600" />
                        {formatMoneyFromUSD(amount, currency)}
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2 font-semibold text-gray-700">
                        <Briefcase size={16} className="text-teal-600" />
                        {gig.job.isRemote ? 'Remote gig' : 'On-site gig'}
                      </div>
                    </div>

                    <p className="max-w-3xl whitespace-pre-wrap text-sm leading-6 text-gray-600">{gig.job.description}</p>
                  </div>

                  <div className="w-full max-w-sm rounded-3xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      {isClientView ? 'Assigned freelancer' : 'Client'}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      {counterpart ? (
                        <>
                          <CachedImage
                            src={counterpart.photoURL}
                            alt={counterpart.displayName}
                            wrapperClassName="h-14 w-14 rounded-2xl border border-gray-200 bg-white"
                            imgClassName="h-full w-full rounded-2xl object-cover"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-gray-900">{counterpart.displayName}</p>
                            <p className="truncate text-xs text-gray-500">{counterpart.publicId || counterpart.uid}</p>
                          </div>
                        </>
                      ) : (
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500">
                          <UserRound size={16} />
                          Loading profile...
                        </div>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      {counterpart && (
                        <>
                          <button
                            onClick={() => navigate(`/messages?uid=${counterpart.uid}`)}
                            className="w-full rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800"
                          >
                            Message {isClientView ? 'freelancer' : 'client'}
                          </button>
                          <button
                            onClick={() => navigate(`/profile/${counterpart.uid}`)}
                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            View profile
                          </button>
                        </>
                      )}
                      {isClientView ? (
                        <>
                          <button
                            onClick={() => navigate(`/manage-gigs?jobId=${gig.job.id}`)}
                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            Manage gig
                          </button>
                          <button
                            onClick={() => handleRevoke(gig)}
                            disabled={revokingId === gig.proposal.id}
                            className="w-full rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-100 disabled:opacity-70"
                          >
                            {revokingId === gig.proposal.id ? 'Revoking...' : 'Revoke assignment'}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => navigate(`/jobs/${gig.job.id}`)}
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          View gig details
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-gray-900">{value}</p>
    </div>
  );
}
