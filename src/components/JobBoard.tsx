import React, { useState, useEffect } from 'react';
import { UserProfile, Job, CompanyPartnerRequest } from '../types';
import { supabaseService } from '../services/supabaseService';
import { Search, Filter, Briefcase, MapPin, Clock, CheckCircle, Plus, Settings, Store } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useCurrency } from '../context/CurrencyContext';
import { convertToUSD, formatMoneyFromUSD } from '../utils/currency';
import CachedImage from './CachedImage';

interface JobBoardProps {
  profile: UserProfile;
}

export default function JobBoard({ profile }: JobBoardProps) {
  const { currency } = useCurrency();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    studentFriendly: false,
    remote: false,
    category: 'All'
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [myPartnerRequest, setMyPartnerRequest] = useState<CompanyPartnerRequest | null>(null);
  const [companyByUid, setCompanyByUid] = useState<Record<string, CompanyPartnerRequest>>({});
  const [newJob, setNewJob] = useState({
    title: '',
    description: '',
    budget: 0,
    category: 'Design',
    isStudentFriendly: true,
    isRemote: true
  });

  useEffect(() => {
    const unsubscribe = supabaseService.subscribeToJobs(setJobs);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    supabaseService.getMyCompanyPartnerRequest(profile.uid).then(setMyPartnerRequest).catch(() => undefined);
  }, [profile.uid]);

  useEffect(() => {
    const jobClientUids = Array.from(new Set(jobs.map((job) => job.clientUid)));
    if (jobClientUids.length === 0) return;
    supabaseService.getApprovedCompanyPartnerRequestsByUserUids(jobClientUids).then(setCompanyByUid).catch(() => undefined);
  }, [jobs]);

  useEffect(() => {
    let result = jobs;
    if (searchQuery) {
      result = result.filter(j => 
        j.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        j.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (filters.studentFriendly) result = result.filter(j => j.isStudentFriendly);
    if (filters.remote) result = result.filter(j => j.isRemote);
    if (filters.category !== 'All') result = result.filter(j => j.category === filters.category);
    setFilteredJobs(result);
  }, [jobs, searchQuery, filters]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabaseService.createJob({
      clientUid: profile.uid,
      ...newJob,
      budget: Number(convertToUSD(newJob.budget, currency).toFixed(6)),
    });
    setShowCreateModal(false);
    setNewJob({
      title: '',
      description: '',
      budget: 0,
      category: 'Design',
      isStudentFriendly: true,
      isRemote: true
    });
  };

  return (
    <div className="space-y-8">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Job Board</h1>
          <p className="text-sm sm:text-base text-gray-500">Find the perfect gig or hire top talent.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/market"
            className="inline-flex items-center gap-2 self-start rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-all hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
          >
            <Store size={18} />
            Market
          </Link>
          {myPartnerRequest?.status === 'approved' ? (
            <Link
              to="/manage-gigs"
              className="inline-flex items-center gap-2 self-start rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-teal-800"
            >
              <Briefcase size={18} />
              Manage Gigs
            </Link>
          ) : (
            <Link
              to="/partner-with-connect"
              className="inline-flex items-center gap-2 self-start rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-all hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
            >
              <Briefcase size={18} />
              Partner With Connect
            </Link>
          )}
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 space-y-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search for jobs, skills, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-2xl text-sm transition-all"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100 w-full sm:w-auto">
            <Filter size={16} className="text-gray-400" />
            <select 
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="bg-transparent text-sm font-semibold text-gray-700 focus:outline-none w-full"
            >
              <option>All</option>
              <option>Design</option>
              <option>Development</option>
              <option>Writing</option>
              <option>Marketing</option>
              <option>Data Science</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={filters.studentFriendly}
              onChange={(e) => setFilters({ ...filters, studentFriendly: e.target.checked })}
              className="w-5 h-5 rounded-lg border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">Student Friendly</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={filters.remote}
              onChange={(e) => setFilters({ ...filters, remote: e.target.checked })}
              className="w-5 h-5 rounded-lg border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">Remote Only</span>
          </label>
        </div>
      </div>

      {/* Jobs List */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filteredJobs.length > 0 ? (
            filteredJobs.map((job) => (
              <motion.div
                key={job.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group flex flex-col rounded-[1.75rem] border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-teal-200 hover:shadow-md sm:p-5"
              >
                {companyByUid[job.clientUid] && (
                  <div className="mb-3 flex items-center gap-3">
                    <CachedImage
                      src={companyByUid[job.clientUid].companyLogoUrl}
                      alt={companyByUid[job.clientUid].companyName}
                      fallbackMode="logo"
                      wrapperClassName="h-10 w-10 rounded-2xl bg-gray-100"
                      imgClassName="h-full w-full rounded-2xl object-cover"
                    />
                    <div>
                      <p className="text-sm font-bold text-gray-900">{companyByUid[job.clientUid].companyName}</p>
                      <p className="text-[11px] text-gray-400">{companyByUid[job.clientUid].location}</p>
                    </div>
                  </div>
                )}
                <div className="mb-3 flex items-start justify-between">
                  <div className="rounded-2xl bg-teal-50 p-2.5 text-teal-700 transition-colors group-hover:bg-teal-600 group-hover:text-white">
                    <Briefcase size={20} />
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-teal-700">{formatMoneyFromUSD(job.budget, currency)}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Fixed Price</p>
                  </div>
                </div>
                
                <h3 className="mb-2 text-base font-bold text-gray-900 transition-colors group-hover:text-teal-700 sm:text-lg">{job.title}</h3>
                <p className="mb-4 flex-1 line-clamp-3 text-sm text-gray-600">{job.description}</p>
                
                <div className="mb-4 flex flex-wrap gap-2">
                  <span className="flex items-center gap-1 rounded-xl bg-gray-50 px-2.5 py-1.5 text-[10px] font-bold text-gray-500 sm:text-xs">
                    <MapPin size={12} /> {job.isRemote ? 'Remote' : 'On-site'}
                  </span>
                  <span className="flex items-center gap-1 rounded-xl bg-gray-50 px-2.5 py-1.5 text-[10px] font-bold text-gray-500 sm:text-xs">
                    <Clock size={12} /> {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                  </span>
                  {job.isStudentFriendly && (
                    <span className="flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-600 sm:text-xs">
                      <CheckCircle size={12} /> Student Friendly
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/jobs/${job.id}`}
                    className="flex-1 rounded-2xl bg-gray-900 px-4 py-2.5 text-center text-sm font-bold text-white transition-all hover:bg-teal-700"
                  >
                    View Details & Apply
                  </Link>
                  {profile.role === 'client' && profile.uid === job.clientUid && (
                    <Link
                      to={`/manage-gigs?jobId=${job.id}`}
                      className="p-3 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"
                      title="Manage this gig"
                    >
                      <Settings size={18} />
                    </Link>
                  )}
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full py-20 text-center"
            >
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={32} className="text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No gigs found</h3>
              <p className="text-gray-500">Try adjusting your search or filters to find what you're looking for.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Job Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 overflow-y-auto max-h-[90vh]"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Post a New Gig</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Gig Title</label>
                <input
                  type="text"
                  required
                  value={newJob.title}
                  onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                  placeholder="e.g. Design a Landing Page for a Startup"
                  className="w-full px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-sm transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Description</label>
                <textarea
                  required
                  value={newJob.description}
                  onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                  placeholder="Describe the project requirements, scope, and deliverables..."
                  className="w-full px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-sm transition-all min-h-[150px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Budget ({currency})</label>
                  <input
                    type="number"
                    required
                    value={newJob.budget}
                    onChange={(e) => setNewJob({ ...newJob, budget: Number(e.target.value || 0) })}
                    className="w-full px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-sm transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Category</label>
                  <select
                    value={newJob.category}
                    onChange={(e) => setNewJob({ ...newJob, category: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-teal-500 rounded-xl text-sm transition-all"
                  >
                    <option>Design</option>
                    <option>Development</option>
                    <option>Writing</option>
                    <option>Marketing</option>
                    <option>Data Science</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 sm:gap-8">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newJob.isStudentFriendly}
                    onChange={(e) => setNewJob({ ...newJob, isStudentFriendly: e.target.checked })}
                    className="w-5 h-5 rounded-lg border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm font-bold text-gray-600">Student Friendly</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newJob.isRemote}
                    onChange={(e) => setNewJob({ ...newJob, isRemote: e.target.checked })}
                    className="w-5 h-5 rounded-lg border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm font-bold text-gray-600">Remote Gig</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-teal-700 text-white font-bold py-4 px-6 rounded-2xl hover:bg-teal-800 transition-all shadow-lg shadow-teal-100"
              >
                Post Gig
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {myPartnerRequest?.status === 'approved' && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="fixed bottom-24 md:bottom-8 right-6 z-30 w-14 h-14 rounded-full bg-teal-600 text-white shadow-xl hover:bg-teal-700 transition-all flex items-center justify-center"
          aria-label="Post new gig"
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  );
}
