import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { UserProfile, UserRole } from '../types';
import { supabaseService } from '../services/supabaseService';
import { getCartoonAvatar } from '../utils/avatar';
import { Briefcase, UserCheck, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface OnboardingProps {
  user: User;
  onComplete: (profile: UserProfile) => void;
}

export default function Onboarding({ user, onComplete }: OnboardingProps) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    if (!role) return;
    setLoading(true);
    const profile: UserProfile = {
      uid: user.id,
      publicId: `SL-${user.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`,
      email: user.email || '',
      displayName: user.user_metadata?.full_name || user.user_metadata?.name || 'Anonymous',
      photoURL: user.user_metadata?.avatar_url || getCartoonAvatar(user.user_metadata?.full_name || user.id),
      role,
      bio: '',
      skills: [],
      education: {
        university: '',
        degree: '',
        verified: false
      },
      portfolio: [],
      companyInfo: {
        name: '',
        about: ''
      }
    };
    await supabaseService.createUserProfile(profile);
    onComplete(profile);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl p-8 md:p-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-teal-800 mb-4">Welcome to Connect</h1>
          <p className="text-gray-600 text-lg">Choose your primary role to get started.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setRole('freelancer')}
            className={`p-8 rounded-2xl border-2 text-left transition-all ${
              role === 'freelancer' 
                ? 'border-teal-600 bg-teal-50 ring-4 ring-teal-100' 
                : 'border-gray-100 hover:border-teal-200 hover:bg-gray-50'
            }`}
          >
            <div className="bg-teal-600 text-white w-12 h-12 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-teal-200">
              <UserCheck size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">I'm a Freelancer</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              I want to showcase my skills, build my portfolio, and find student-friendly gigs.
            </p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setRole('client')}
            className={`p-8 rounded-2xl border-2 text-left transition-all ${
              role === 'client' 
                ? 'border-teal-600 bg-teal-50 ring-4 ring-teal-100' 
                : 'border-gray-100 hover:border-teal-200 hover:bg-gray-50'
            }`}
          >
            <div className="bg-teal-600 text-white w-12 h-12 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-teal-200">
              <Briefcase size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">I'm a Client</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              I want to hire talented students and professionals for my projects and company.
            </p>
          </motion.button>
        </div>

        <button
          disabled={!role || loading}
          onClick={handleComplete}
          className="w-full bg-teal-700 text-white font-bold py-4 px-6 rounded-2xl hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-lg shadow-lg shadow-teal-100"
        >
          {loading ? 'Setting up...' : 'Continue to Dashboard'}
          {!loading && <ArrowRight size={20} />}
        </button>
      </div>
    </div>
  );
}
