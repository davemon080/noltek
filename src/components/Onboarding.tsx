import React, { useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { UserProfile, UserRole } from '../types';
import { supabaseService } from '../services/supabaseService';
import { getCartoonAvatar } from '../utils/avatar';
import { Briefcase, UserCheck, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { getErrorMessage } from '../utils/errors';

interface OnboardingProps {
  user: User;
  onComplete: (profile: UserProfile) => void;
}

type StepId = 'role' | 'basics' | 'education' | 'about';

type OnboardingDraft = {
  role: UserRole | null;
  displayName: string;
  phoneNumber: string;
  location: string;
  status: string;
  university: string;
  degree: string;
  year: string;
  skills: string;
  bio: string;
  linkedin: string;
  github: string;
  website: string;
};

const STEPS: Array<{ id: StepId; title: string; description: string; skippable: boolean }> = [
  { id: 'role', title: 'Choose your role', description: 'Tell Connect how you plan to use the platform.', skippable: false },
  { id: 'basics', title: 'Basic profile details', description: 'Add the main details people should see on your profile.', skippable: true },
  { id: 'education', title: 'Education and skills', description: 'Share academic details and skills to improve discovery.', skippable: true },
  { id: 'about', title: 'About you', description: 'Finish with a short intro and optional links.', skippable: true },
];

const INPUT_CLASS =
  'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition-all placeholder:text-gray-400 focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-500/20';

export default function Onboarding({ user, onComplete }: OnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<OnboardingDraft>({
    role: null,
    displayName: user.user_metadata?.full_name || user.user_metadata?.name || '',
    phoneNumber: '',
    location: '',
    status: '',
    university: '',
    degree: '',
    year: '',
    skills: '',
    bio: '',
    linkedin: '',
    github: '',
    website: '',
  });

  const currentStep = STEPS[stepIndex];
  const progress = useMemo(() => Math.round(((stepIndex + 1) / STEPS.length) * 100), [stepIndex]);

  const updateDraft = (key: keyof OnboardingDraft, value: string | UserRole | null) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (currentStep.id === 'role' && !draft.role) {
      setError('Choose whether you are joining as a freelancer or a client to continue.');
      return;
    }
    setError('');
    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleSkip = () => {
    setError('');
    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleComplete = async () => {
    if (!draft.role) {
      setError('Choose a role before finishing onboarding.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const skills = draft.skills
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const profile: UserProfile = {
        uid: user.id,
        publicId: `SL-${user.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`,
        email: user.email || '',
        displayName: draft.displayName.trim() || user.user_metadata?.full_name || 'Anonymous',
        photoURL: user.user_metadata?.avatar_url || getCartoonAvatar(draft.displayName || user.id),
        role: draft.role,
        bio: draft.bio.trim(),
        phoneNumber: draft.phoneNumber.trim(),
        location: draft.location.trim(),
        status: draft.status.trim(),
        skills,
        education: {
          university: draft.university.trim(),
          degree: draft.degree.trim(),
          year: draft.year.trim(),
          verified: false,
        },
        socialLinks: {
          linkedin: draft.linkedin.trim(),
          github: draft.github.trim(),
          website: draft.website.trim(),
        },
        portfolio: [],
        companyInfo: {
          name: '',
          about: '',
        },
      };

      await supabaseService.createUserProfile(profile);
      onComplete(profile);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'We could not finish onboarding right now. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.15),_transparent_35%),linear-gradient(135deg,#f8fafc,#eefbf7)] px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-white/60 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)] lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="hidden bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-600 p-10 text-white lg:flex lg:flex-col">
          <div className="max-w-md">
            <p className="rounded-full bg-white/15 px-4 py-1 text-xs font-bold uppercase tracking-[0.28em] text-white/90">
              Connect Setup
            </p>
            <h1 className="mt-6 text-4xl font-black leading-tight">Build a profile people can trust from day one.</h1>
            <p className="mt-4 text-sm leading-7 text-white/80">
              We will guide you through a few short sections. You can skip optional steps now and finish them later from your profile.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            {STEPS.map((step, index) => {
              const complete = index < stepIndex;
              const active = index === stepIndex;
              return (
                <div
                  key={step.id}
                  className={`rounded-3xl border px-5 py-4 transition-all ${
                    active ? 'border-white/40 bg-white/15' : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-bold ${complete || active ? 'bg-white text-teal-700' : 'bg-white/10 text-white'}`}>
                      {complete ? <CheckCircle2 size={18} /> : index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-bold">{step.title}</p>
                      <p className="text-xs text-white/75">{step.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="flex flex-col p-6 md:p-10">
          <div className="mb-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-teal-700">Step {stepIndex + 1} of {STEPS.length}</p>
                <h2 className="mt-2 text-3xl font-black text-gray-900">{currentStep.title}</h2>
                <p className="mt-2 text-sm text-gray-500">{currentStep.description}</p>
              </div>
              <div className="min-w-[88px] rounded-2xl bg-gray-100 px-4 py-3 text-center">
                <p className="text-2xl font-black text-teal-700">{progress}%</p>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Complete</p>
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="flex-1">
            {currentStep.id === 'role' && (
              <div className="grid gap-5 md:grid-cols-2">
                {[
                  {
                    value: 'freelancer' as UserRole,
                    title: "I'm a Freelancer",
                    description: 'Showcase your skills, build your profile, and win gigs.',
                    icon: UserCheck,
                  },
                  {
                    value: 'client' as UserRole,
                    title: "I'm a Client",
                    description: 'Post projects, discover talent, and manage hiring faster.',
                    icon: Briefcase,
                  },
                ].map((option) => (
                  <motion.button
                    key={option.value}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => updateDraft('role', option.value)}
                    className={`rounded-[1.75rem] border-2 p-6 text-left transition-all ${
                      draft.role === option.value
                        ? 'border-teal-600 bg-teal-50 shadow-lg shadow-teal-100'
                        : 'border-gray-100 bg-white hover:border-teal-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 text-white">
                      <option.icon size={26} />
                    </div>
                    <h3 className="mt-5 text-xl font-bold text-gray-900">{option.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-gray-600">{option.description}</p>
                  </motion.button>
                ))}
              </div>
            )}

            {currentStep.id === 'basics' && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Display name">
                  <input value={draft.displayName} onChange={(e) => updateDraft('displayName', e.target.value)} className={INPUT_CLASS} placeholder="How should people know you?" />
                </Field>
                <Field label="Phone number">
                  <input value={draft.phoneNumber} onChange={(e) => updateDraft('phoneNumber', e.target.value)} className={INPUT_CLASS} placeholder="Optional phone number" />
                </Field>
                <Field label="Location">
                  <input value={draft.location} onChange={(e) => updateDraft('location', e.target.value)} className={INPUT_CLASS} placeholder="City, state, or campus" />
                </Field>
                <Field label="Status headline">
                  <input value={draft.status} onChange={(e) => updateDraft('status', e.target.value)} className={INPUT_CLASS} placeholder="Frontend student, hiring manager, designer..." />
                </Field>
              </div>
            )}

            {currentStep.id === 'education' && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="University">
                  <input value={draft.university} onChange={(e) => updateDraft('university', e.target.value)} className={INPUT_CLASS} placeholder="School or university" />
                </Field>
                <Field label="Degree">
                  <input value={draft.degree} onChange={(e) => updateDraft('degree', e.target.value)} className={INPUT_CLASS} placeholder="Course of study or degree" />
                </Field>
                <Field label="Graduation year">
                  <input value={draft.year} onChange={(e) => updateDraft('year', e.target.value)} className={INPUT_CLASS} placeholder="2027" />
                </Field>
                <Field label="Skills">
                  <input value={draft.skills} onChange={(e) => updateDraft('skills', e.target.value)} className={INPUT_CLASS} placeholder="React, UI Design, Copywriting" />
                </Field>
              </div>
            )}

            {currentStep.id === 'about' && (
              <div className="space-y-4">
                <Field label="Short bio">
                  <textarea value={draft.bio} onChange={(e) => updateDraft('bio', e.target.value)} className={`${INPUT_CLASS} min-h-[140px]`} placeholder="Tell people what you do, what you are studying, and what kind of opportunities you want." />
                </Field>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="LinkedIn">
                    <input value={draft.linkedin} onChange={(e) => updateDraft('linkedin', e.target.value)} className={INPUT_CLASS} placeholder="https://linkedin.com/in/..." />
                  </Field>
                  <Field label="GitHub">
                    <input value={draft.github} onChange={(e) => updateDraft('github', e.target.value)} className={INPUT_CLASS} placeholder="https://github.com/..." />
                  </Field>
                  <Field label="Website">
                    <input value={draft.website} onChange={(e) => updateDraft('website', e.target.value)} className={INPUT_CLASS} placeholder="https://yourportfolio.com" />
                  </Field>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
                disabled={stepIndex === 0 || loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              {currentStep.skippable && stepIndex < STEPS.length - 1 && (
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={loading}
                  className="rounded-2xl px-5 py-3 text-sm font-bold text-gray-500 transition-all hover:bg-gray-50 hover:text-gray-700"
                >
                  Skip for now
                </button>
              )}
            </div>

            {stepIndex < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-700 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-teal-800 disabled:opacity-60"
              >
                Next
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-700 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-teal-800 disabled:opacity-60"
              >
                {loading ? 'Finishing setup...' : 'Complete onboarding'}
                {!loading && <ArrowRight size={16} />}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{label}</span>
      {children}
    </label>
  );
}
