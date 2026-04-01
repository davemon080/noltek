import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Globe, Link2, Loader2, Send, Upload, BadgeCheck } from 'lucide-react';
import { UserProfile, CompanyPartnerRequest } from '../types';
import { supabaseService } from '../services/supabaseService';
import CachedImage from './CachedImage';
import { AnimatePresence, motion } from 'motion/react';

interface PartnershipPageProps {
  profile?: UserProfile | null;
  onBack?: () => void;
}

const LOCATION_OPTIONS = [
  'Lagos, Nigeria',
  'Abuja, Nigeria',
  'Port Harcourt, Nigeria',
  'Ibadan, Nigeria',
  'Accra, Ghana',
  'Nairobi, Kenya',
  'Cape Town, South Africa',
  'London, United Kingdom',
  'Remote / Global',
] as const;

export default function PartnershipPage({ profile, onBack }: PartnershipPageProps) {
  const navigate = useNavigate();
  const [request, setRequest] = useState<CompanyPartnerRequest | null>(null);
  const [loading, setLoading] = useState(!!profile);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<string[]>(['']);
  const [about, setAbout] = useState('');
  const [location, setLocation] = useState<string>(LOCATION_OPTIONS[0]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [registrationFiles, setRegistrationFiles] = useState<File[]>([]);
  const [successEffect, setSuccessEffect] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const unsubscribe = supabaseService.subscribeToMyCompanyPartnerRequest(profile.uid, (nextRequest) => {
      setRequest(nextRequest);
      if (nextRequest) {
        setCompanyName(nextRequest.companyName);
        setWebsiteUrl(nextRequest.websiteUrl || '');
        setSocialLinks(nextRequest.socialLinks.length > 0 ? nextRequest.socialLinks : ['']);
        setAbout(nextRequest.about);
        setLocation(nextRequest.location);
        setLogoPreview(nextRequest.companyLogoUrl);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profile]);

  const normalizedSocialLinks = useMemo(
    () => socialLinks.map((item) => item.trim()).filter(Boolean),
    [socialLinks]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    if (normalizedSocialLinks.length === 0) {
      setMessage('Add at least one social media link.');
      return;
    }
    if (!logoFile && !logoPreview) {
      setMessage('Upload your company logo.');
      return;
    }
    if (registrationFiles.length === 0 && !request?.registrationUrls?.length) {
      setMessage('Attach at least one company registration file.');
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const logoUrl = logoFile
        ? await supabaseService.uploadUserAsset(logoFile, 'partner/logo')
        : logoPreview || '';
      const registrationUploads = registrationFiles.length > 0
        ? await Promise.all(registrationFiles.map((file) => supabaseService.uploadFile(file, 'partner/registration')))
        : [];

      const nextRequest = await supabaseService.submitCompanyPartnerRequest({
        userUid: profile.uid,
        companyName: companyName.trim(),
        companyLogoUrl: logoUrl,
        websiteUrl: websiteUrl.trim() || undefined,
        socialLinks: normalizedSocialLinks,
        about: about.trim(),
        location,
        registrationUrls: registrationUploads.length > 0 ? registrationUploads.map((item) => item.url) : (request?.registrationUrls || []),
      });
      setRequest(nextRequest);
      await supabaseService.updateUserProfile(profile.uid, {
        role: 'client',
        companyInfo: {
          name: companyName.trim(),
          about: about.trim(),
        },
      });
      setMessage(nextRequest.status === 'approved' ? 'Company profile approved.' : 'Partner request sent successfully.');
    } catch (error: any) {
      setMessage(error?.message || 'Failed to send partner request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <AnimatePresence>
        {successEffect && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            className="fixed right-4 top-4 z-50 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-bold text-white shadow-2xl"
          >
            {successEffect}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (onBack ? onBack() : navigate(-1))}
            className="rounded-full p-2 hover:bg-gray-100"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Partner With Connect</h1>
            <p className="text-sm text-gray-500">Bring your company in, get approved, and start hiring freelancers on Connect.</p>
          </div>
        </div>

        {!profile ? (
          <div className="grid gap-6 rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-700">
                <Building2 size={14} />
                Company Partnership
              </span>
              <h2 className="text-3xl font-black text-gray-900">Register your company and hire the right freelancers.</h2>
            <p className="text-sm leading-relaxed text-gray-600">
                Companies can submit a partnership request with their logo, links, documents, and business profile. After approval, they can manage gigs directly from their normal account.
              </p>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
                Sign in or create an account first to submit a partnership request.
              </div>
            </div>
            <div className="rounded-[1.75rem] bg-gray-50 p-6">
              <p className="text-sm font-bold text-gray-900">Required for approval</p>
              <ul className="mt-4 space-y-3 text-sm text-gray-600">
                <li>Company name and logo</li>
                <li>At least one social media profile</li>
                <li>What your company does</li>
                <li>Business location</li>
                <li>Company registration documents</li>
              </ul>
            </div>
          </div>
        ) : loading ? (
          <div className="rounded-[2rem] border border-gray-200 bg-white p-8 text-sm text-gray-500 shadow-sm">Loading partner profile...</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <form onSubmit={handleSubmit} className="space-y-5 rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Company Name</label>
                  <input
                    required
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    className="w-full rounded-2xl bg-gray-50 px-4 py-3 text-sm outline-none ring-0 transition-all focus:bg-white focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Location</label>
                  <select
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    className="w-full rounded-2xl bg-gray-50 px-4 py-3 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-teal-500"
                  >
                    {LOCATION_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Company Logo</label>
                <label className="flex cursor-pointer items-center gap-4 rounded-[1.5rem] border border-dashed border-gray-300 bg-gray-50 p-4">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl bg-white shadow-sm">
                    {logoPreview ? (
                      <CachedImage src={logoPreview} alt="Company logo" wrapperClassName="h-full w-full" imgClassName="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300"><Building2 size={28} /></div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Upload Company Logo</p>
                    <p className="text-xs text-gray-500">PNG, JPG, or WEBP</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setLogoFile(file);
                      setLogoPreview(URL.createObjectURL(file));
                    }}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Website Link</label>
                <div className="relative">
                  <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={websiteUrl}
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                    placeholder="Optional website URL"
                    className="w-full rounded-2xl bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Social Media Links</label>
                {socialLinks.map((value, index) => (
                  <div key={index} className="relative">
                    <Link2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={value}
                      onChange={(event) => {
                        const next = [...socialLinks];
                        next[index] = event.target.value;
                        setSocialLinks(next);
                      }}
                      placeholder={`Social link ${index + 1}`}
                      className="w-full rounded-2xl bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSocialLinks((prev) => [...prev, ''])}
                  className="text-sm font-bold text-teal-700 hover:text-teal-800"
                >
                  Add another social link
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">About the Company</label>
                <textarea
                  required
                  value={about}
                  onChange={(event) => setAbout(event.target.value)}
                  rows={5}
                  placeholder="What does your company do and what kind of freelancers do you hire?"
                  className="w-full rounded-2xl bg-gray-50 px-4 py-3 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Company Registration Files</label>
                <label className="flex cursor-pointer items-center justify-center gap-3 rounded-[1.5rem] border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm font-bold text-gray-700">
                  <Upload size={18} />
                  Attach registration documents
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => setRegistrationFiles(Array.from(event.target.files || []))}
                  />
                </label>
                {(registrationFiles.length > 0 || request?.registrationUrls.length) && (
                  <p className="text-xs text-gray-500">
                    {registrationFiles.length > 0
                      ? `${registrationFiles.length} new file(s) attached`
                      : `${request?.registrationUrls.length || 0} file(s) already on record`}
                  </p>
                )}
              </div>

              {message && (
                <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${message.toLowerCase().includes('failed') || message.toLowerCase().includes('add') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-4 text-sm font-bold text-white transition-colors hover:bg-teal-800 disabled:opacity-70"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Send Partner Request
              </button>
            </form>

            <div className="space-y-5 rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
              <div className="rounded-[1.5rem] bg-gray-50 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Approval Status</p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-gray-900 shadow-sm">
                  <BadgeCheck size={16} className={request?.status === 'approved' ? 'text-emerald-600' : request?.status === 'rejected' ? 'text-red-600' : 'text-amber-600'} />
                  {request ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : 'No request yet'}
                </div>
                <p className="mt-3 text-sm text-gray-500">
                  {request?.status === 'approved'
                    ? 'Your company has been approved. You can now manage gigs directly from this account.'
                    : request?.status === 'rejected'
                    ? 'Your previous request was not approved. Update your details and submit again.'
                    : request
                    ? 'Your partner request is under review. We will confirm it before company tools are unlocked.'
                    : 'Submit your details so the Connect team can review and approve your company.'}
                </p>
              </div>

              {request?.status === 'approved' && (
                <div className="space-y-3">
                  <Link
                    to="/manage-gigs"
                    className="block w-full rounded-2xl bg-gray-900 px-4 py-4 text-center text-sm font-bold text-white hover:bg-gray-800"
                  >
                    Open Gig Manager
                  </Link>
                </div>
              )}

              <div className="rounded-[1.5rem] border border-gray-200 p-5">
                <p className="text-sm font-bold text-gray-900">What happens next?</p>
                <ul className="mt-3 space-y-3 text-sm text-gray-600">
                  <li>1. We review your company details and registration documents.</li>
                  <li>2. Once approved, your company can post gigs and manage applicants from the same account.</li>
                  <li>3. Your approved company logo shows on jobs you publish.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
