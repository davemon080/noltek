import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserProfile, Job, Proposal } from '../types';
import { supabaseService } from '../services/supabaseService';
import { ArrowLeft, CheckCircle2, CircleDollarSign, Pencil, Search, Trash2, X, XCircle } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { convertAmount, convertToUSD, formatAmount, formatMoneyFromUSD } from '../utils/currency';
import { useConfirmDialog } from './ConfirmDialog';

interface ManageGigsProps {
  profile: UserProfile;
}

type JobDraft = {
  title: string;
  description: string;
  budget: number;
  category: string;
  isStudentFriendly: boolean;
  isRemote: boolean;
};

const defaultDraft: JobDraft = {
  title: '',
  description: '',
  budget: 0,
  category: 'Design',
  isStudentFriendly: true,
  isRemote: true,
};

export default function ManageGigs({ profile }: ManageGigsProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currency } = useCurrency();
  const requestedJobId = searchParams.get('jobId');

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Proposal[]>([]);
  const [applicantProfiles, setApplicantProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [isApprovedCompany, setIsApprovedCompany] = useState<boolean | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [jobDraft, setJobDraft] = useState<JobDraft>(defaultDraft);
  const [savingJob, setSavingJob] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();

  useEffect(() => {
    supabaseService.getMyCompanyPartnerRequest(profile.uid).then((request) => {
      setIsApprovedCompany(request?.status === 'approved');
    }).catch(() => undefined);
  }, [profile.uid]);

  useEffect(() => {
    if (profile.role !== 'client' && isApprovedCompany === null) {
      return;
    }
    if (profile.role !== 'client' && !isApprovedCompany) {
      navigate('/');
      return;
    }

    const unsubscribe = supabaseService.subscribeToClientJobs(profile.uid, (clientJobs) => {
      setJobs(clientJobs);
      setSelectedJob((prev) => {
        const desiredId = requestedJobId || prev?.id;
        if (!desiredId) return clientJobs[0] || null;
        return clientJobs.find((job) => job.id === desiredId) || clientJobs[0] || null;
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isApprovedCompany, navigate, profile.role, profile.uid, requestedJobId]);

  useEffect(() => {
    if (!selectedJob) {
      setApplications([]);
      return;
    }
    const unsubscribe = supabaseService.subscribeToJobProposals(selectedJob.id, setApplications);
    return () => unsubscribe();
  }, [selectedJob]);

  useEffect(() => {
    const applicantUids = Array.from(new Set(applications.map((application) => application.freelancerUid).filter(Boolean)));
    if (applicantUids.length === 0) {
      setApplicantProfiles({});
      return;
    }

    let active = true;
    supabaseService.getUsersByUids(applicantUids)
      .then((users) => {
        if (!active) return;
        setApplicantProfiles(
          users.reduce<Record<string, UserProfile>>((acc, user) => {
            acc[user.uid] = user;
            return acc;
          }, {})
        );
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [applications]);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const applicant = applicantProfiles[app.freelancerUid];
      const matchesStatus = statusFilter === 'all' ? true : app.status === statusFilter;
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery = normalizedQuery
        ? [
            app.content,
            applicant?.displayName,
            applicant?.publicId,
            applicant?.uid,
            applicant?.skills?.join(' '),
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedQuery))
        : true;
      return matchesStatus && matchesQuery;
    });
  }, [applicantProfiles, applications, query, statusFilter]);

  const handleToggleStatus = async (job: Job) => {
    const nextStatus = job.status === 'open' ? 'closed' : 'open';
    await supabaseService.updateJobStatus(job.id, nextStatus);
  };

  const handleDeleteJob = async (jobId: string) => {
    const confirmed = await confirm({
      title: 'Delete this gig?',
      description: 'This will permanently remove the gig and cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    await supabaseService.deleteJob(jobId);
    if (selectedJob?.id === jobId) setSelectedJob(null);
  };

  const handleApplicationStatus = async (applicationId: string, nextStatus: 'accepted' | 'rejected') => {
    await supabaseService.updateProposalStatus(applicationId, nextStatus);
  };

  const handleRevokeAssignment = async (applicationId: string) => {
    const confirmed = await confirm({
      title: 'Revoke this assignment?',
      description: 'The freelancer will be removed from this gig and the job will return to the public jobs page.',
      confirmLabel: 'Revoke Gig',
      tone: 'danger',
    });
    if (!confirmed) return;
    await supabaseService.updateProposalStatus(applicationId, 'pending');
  };

  const openEditModal = (job: Job) => {
    setEditingJob(job);
    setJobDraft({
      title: job.title,
      description: job.description,
      budget: Number(convertAmount(job.budget, 'USD', currency).toFixed(2)),
      category: job.category,
      isStudentFriendly: job.isStudentFriendly,
      isRemote: job.isRemote,
    });
  };

  const closeEditModal = () => {
    setEditingJob(null);
    setJobDraft(defaultDraft);
    setSavingJob(false);
  };

  const submitJobEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;
    setSavingJob(true);
    try {
      await supabaseService.updateJob(editingJob.id, {
        title: jobDraft.title.trim(),
        description: jobDraft.description.trim(),
        category: jobDraft.category,
        budget: Number(convertToUSD(jobDraft.budget, currency).toFixed(6)),
        isStudentFriendly: jobDraft.isStudentFriendly,
        isRemote: jobDraft.isRemote,
      });
      closeEditModal();
    } finally {
      setSavingJob(false);
    }
  };

  const launchApplicantPayment = (application: Proposal) => {
    const applicant = applicantProfiles[application.freelancerUid];
    const selectedJobBudget = selectedJob?.budget || 0;
    const agreedUsdAmount =
      application.budget > 0 && Math.abs(application.budget - selectedJobBudget) >= 0.01
        ? application.budget
        : selectedJobBudget;
    const amountInWalletCurrency = Number(convertAmount(agreedUsdAmount, 'USD', currency).toFixed(2));
    const params = new URLSearchParams({
      recipient: encodeURIComponent(applicant?.publicId || applicant?.uid || application.freelancerUid),
      name: encodeURIComponent(applicant?.displayName || application.freelancerUid),
      amount: amountInWalletCurrency.toString(),
      currency,
      autoPin: '1',
      source: 'gig-payment',
      jobId: selectedJob?.id || '',
    });
    navigate(`/wallets/transfer/details?${params.toString()}`);
  };

  const stats = useMemo(() => {
    const openJobs = jobs.filter((j) => j.status === 'open').length;
    const pending = applications.filter((a) => a.status === 'pending').length;
    return { openJobs, totalJobs: jobs.length, totalApplications: applications.length, pending };
  }, [applications, jobs]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Gigs</h1>
          <p className="text-sm text-gray-500">Review gigs, update details, and pay approved freelancers when work is complete.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Gigs" value={stats.totalJobs} />
        <StatCard label="Open Gigs" value={stats.openJobs} />
        <StatCard label="Applications" value={stats.totalApplications} />
        <StatCard label="Pending Review" value={stats.pending} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-3xl p-4 space-y-3">
          <p className="text-sm font-bold text-gray-900">Your Posted Gigs</p>
          {loading && <p className="text-sm text-gray-500">Loading gigs...</p>}
          {!loading && jobs.length === 0 && <p className="text-sm text-gray-500">No gigs posted yet.</p>}
          {jobs.map((job) => (
            <button
              key={job.id}
              onClick={() => setSelectedJob(job)}
              className={`w-full p-3 rounded-2xl border text-left ${
                selectedJob?.id === job.id ? 'bg-teal-50 border-teal-200' : 'bg-white border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-900 line-clamp-1">{job.title}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${job.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                  {job.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{formatMoneyFromUSD(job.budget, currency)}</p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-3xl p-5">
          {!selectedJob ? (
            <div className="h-full min-h-[300px] flex items-center justify-center text-sm text-gray-500">Select a gig to manage.</div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedJob.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedJob.category} • {formatMoneyFromUSD(selectedJob.budget, currency)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => openEditModal(selectedJob)}
                    className="px-3 py-2 rounded-xl text-sm font-semibold bg-teal-50 hover:bg-teal-100 text-teal-700 inline-flex items-center gap-1.5"
                  >
                    <Pencil size={15} />
                    Edit Gig
                  </button>
                  <button
                    onClick={() => handleToggleStatus(selectedJob)}
                    className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    {selectedJob.status === 'open' ? 'Close Gig' : 'Reopen Gig'}
                  </button>
                  <button
                    onClick={() => handleDeleteJob(selectedJob.id)}
                    className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                    aria-label="Delete gig"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedJob.description}</p>

              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search applications..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="px-3 py-2.5 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-900">Received Applications ({filteredApplications.length})</p>
                {filteredApplications.length === 0 && (
                  <div className="p-8 text-sm text-gray-500 text-center bg-gray-50 rounded-2xl">No applications found for this filter.</div>
                )}
                {filteredApplications.map((application) => {
                  const applicant = applicantProfiles[application.freelancerUid];
                  const payableUsdAmount = application.budget > 0 ? application.budget : selectedJob.budget;
                  return (
                    <div key={application.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{applicant?.displayName || application.freelancerUid}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {applicant?.publicId || application.freelancerUid}
                            {applicant?.skills?.[0] ? ` • ${applicant.skills[0]}` : ''}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Proposed: {formatMoneyFromUSD(application.budget, currency)}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${
                          application.status === 'accepted'
                            ? 'bg-emerald-100 text-emerald-700'
                            : application.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {application.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{application.content}</p>
                      {application.status === 'accepted' && (
                        <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                          Ready for completion payment: {formatMoneyFromUSD(payableUsdAmount, currency)}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {application.status === 'accepted' && (
                          <>
                            <button
                              onClick={() => navigate(`/messages?uid=${application.freelancerUid}`)}
                              className="px-3 py-2 text-xs font-semibold rounded-xl bg-teal-700 text-white hover:bg-teal-800"
                            >
                              Message Applicant
                            </button>
                            <button
                              onClick={() => launchApplicantPayment(application)}
                              className="px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1.5"
                            >
                              <CircleDollarSign size={14} />
                              Pay Freelancer
                            </button>
                            <button
                              onClick={() => handleRevokeAssignment(application.id)}
                              className="px-3 py-2 text-xs font-semibold rounded-xl bg-red-50 text-red-600 hover:bg-red-100 inline-flex items-center gap-1.5"
                            >
                              <XCircle size={14} />
                              Revoke Gig
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => navigate(`/profile/${application.freelancerUid}`)}
                          className="px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                          View Profile
                        </button>
                        {application.status !== 'accepted' && (
                          <button
                            onClick={() => handleApplicationStatus(application.id, 'accepted')}
                            className="px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-100 text-emerald-700 hover:bg-emerald-200 inline-flex items-center gap-1"
                          >
                            <CheckCircle2 size={14} />
                            Accept
                          </button>
                        )}
                        {application.status !== 'rejected' && (
                          <button
                            onClick={() => handleApplicationStatus(application.id, 'rejected')}
                            className="px-3 py-2 text-xs font-semibold rounded-xl bg-red-100 text-red-700 hover:bg-red-200 inline-flex items-center gap-1"
                          >
                            <XCircle size={14} />
                            Reject
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Edit Gig</h3>
                <p className="text-sm text-gray-500">Update the details exactly as you want them to appear.</p>
              </div>
              <button onClick={closeEditModal} className="rounded-full p-2 hover:bg-gray-100" aria-label="Close edit gig modal">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={submitJobEdit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Gig Title</label>
                <input
                  type="text"
                  required
                  value={jobDraft.title}
                  onChange={(e) => setJobDraft((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-xl bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Description</label>
                <textarea
                  required
                  value={jobDraft.description}
                  onChange={(e) => setJobDraft((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-[140px] w-full rounded-xl bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Budget ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={jobDraft.budget}
                    onChange={(e) => setJobDraft((prev) => ({ ...prev, budget: Number(e.target.value || 0) }))}
                    className="w-full rounded-xl bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-xs text-gray-500">This will display as {formatAmount(jobDraft.budget || 0, currency)} after saving.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Category</label>
                  <select
                    value={jobDraft.category}
                    onChange={(e) => setJobDraft((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full rounded-xl bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option>Design</option>
                    <option>Development</option>
                    <option>Writing</option>
                    <option>Marketing</option>
                    <option>Data Science</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={jobDraft.isStudentFriendly}
                    onChange={(e) => setJobDraft((prev) => ({ ...prev, isStudentFriendly: e.target.checked }))}
                    className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  Student Friendly
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={jobDraft.isRemote}
                    onChange={(e) => setJobDraft((prev) => ({ ...prev, isRemote: e.target.checked }))}
                    className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  Remote Gig
                </label>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingJob}
                  className="rounded-2xl bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-70"
                >
                  {savingJob ? 'Saving...' : 'Save Gig Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">{label}</p>
      <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
    </div>
  );
}
