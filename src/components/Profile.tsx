import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UserProfile, Post, CompanyPartnerRequest } from '../types';
import { supabaseService } from '../services/supabaseService';
import { ArrowLeft, Building2, Camera, ExternalLink, Globe, MapPin, MessageSquare, Save, Share2, Plus, Trash2, Copy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import CachedImage from './CachedImage';

interface ProfileProps {
  profile: UserProfile;
}

export default function Profile({ profile: loggedInProfile }: ProfileProps) {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [companyPartner, setCompanyPartner] = useState<CompanyPartnerRequest | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'about' | 'portfolio' | 'activity'>('about');
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const isOwnProfile = uid === loggedInProfile.uid;

  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    let initialized = false;
    const finishInitialLoad = () => {
      if (initialized) return;
      initialized = true;
      setLoading(false);
    };

    const unsubscribeProfile = supabaseService.subscribeToUserProfile(uid, (profile) => {
      setUserProfile(profile);
      setDraft((prev) => (Object.keys(prev).length > 0 && editing ? prev : profile || {}));
      finishInitialLoad();
    });

    const unsubscribePosts = supabaseService.subscribeToPostsByUser(uid, (profilePosts) => {
      setPosts(profilePosts);
      finishInitialLoad();
    });

    const unsubscribePartners = supabaseService.subscribeToApprovedCompanyPartnerRequests(50, (partners) => {
      setCompanyPartner(partners.find((item) => item.userUid === uid) || null);
      finishInitialLoad();
    });

    return () => {
      unsubscribeProfile();
      unsubscribePosts();
      unsubscribePartners();
    };
  }, [editing, uid]);

  const completion = useMemo(() => {
    if (!userProfile) return 0;
    const checks = [
      userProfile.displayName,
      userProfile.bio,
      userProfile.location,
      userProfile.status,
      userProfile.skills?.length,
      userProfile.education?.university,
      userProfile.experience?.length,
      userProfile.socialLinks?.linkedin || userProfile.socialLinks?.github,
      userProfile.portfolio?.length,
      userProfile.companyInfo?.name,
    ];
    const filled = checks.filter((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v))).length;
    return Math.round((filled / checks.length) * 100);
  }, [userProfile]);

  const handleSave = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      await supabaseService.updateUserProfile(uid, draft);
      setUserProfile((prev) => ({ ...(prev as UserProfile), ...(draft as UserProfile) }));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUserId = async () => {
    const value = (editing ? draft.publicId : userProfile.publicId) || userProfile.uid;
    await navigator.clipboard.writeText(value);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1200);
  };

  const handleUploadImage = async (file: File, target: 'photoURL' | 'coverPhotoURL') => {
    const url = await supabaseService.uploadUserAsset(file, target === 'photoURL' ? 'profile/avatar' : 'profile/cover');
    setDraft((prev) => ({ ...prev, [target]: url }));
  };

  const handleAddSkill = () => {
    const skill = window.prompt('Enter skill');
    if (!skill) return;
    setDraft((prev) => ({ ...prev, skills: [...(prev.skills || []), skill.trim()] }));
  };

  const removeSkill = (skill: string) => {
    setDraft((prev) => ({ ...prev, skills: (prev.skills || []).filter((s) => s !== skill) }));
  };

  const addExperience = () => {
    setDraft((prev) => ({
      ...prev,
      experience: [
        ...(prev.experience || []),
        { title: '', company: '', type: '', period: '', description: '' },
      ],
    }));
  };

  const updateExperience = (index: number, key: keyof NonNullable<UserProfile['experience']>[number], value: string) => {
    setDraft((prev) => {
      const next = [...(prev.experience || [])];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, experience: next };
    });
  };

  const removeExperience = (index: number) => {
    setDraft((prev) => ({ ...prev, experience: (prev.experience || []).filter((_, i) => i !== index) }));
  };

  const addPortfolio = () => {
    setDraft((prev) => ({
      ...prev,
      portfolio: [...(prev.portfolio || []), { title: '', imageUrl: '', link: '' }],
    }));
  };

  const updatePortfolio = (index: number, key: 'title' | 'imageUrl' | 'link', value: string) => {
    setDraft((prev) => {
      const next = [...(prev.portfolio || [])];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, portfolio: next };
    });
  };

  const uploadPortfolioImage = async (file: File, index: number) => {
    const url = await supabaseService.uploadUserAsset(file, 'profile/portfolio');
    updatePortfolio(index, 'imageUrl', url);
  };

  if (loading) return <div className="max-w-5xl mx-auto p-6 text-sm text-gray-500">Loading profile...</div>;
  if (!userProfile) return <div className="max-w-5xl mx-auto p-6 text-sm text-gray-500">Profile not found.</div>;

  if (companyPartner) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Company Profile</h1>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-teal-700 via-emerald-600 to-lime-500 px-6 py-10 text-white">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="flex items-center gap-4">
                <CachedImage
                  src={companyPartner.companyLogoUrl}
                  alt={companyPartner.companyName}
                  fallbackMode="logo"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  wrapperClassName="h-24 w-24 rounded-3xl border border-white/30 bg-white/15 p-2"
                  imgClassName="h-full w-full rounded-[1.25rem] object-cover"
                />
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em]">
                    <Building2 size={12} />
                    Approved Partner
                  </p>
                  <h2 className="mt-3 text-3xl font-black">{companyPartner.companyName}</h2>
                  <p className="mt-1 text-sm text-white/85">{companyPartner.location}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigate(`/messages?uid=${userProfile.uid}`)}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-teal-700 hover:bg-teal-50"
                >
                  Message Company
                </button>
                {companyPartner.websiteUrl && (
                  <a
                    href={companyPartner.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl border border-white/30 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 inline-flex items-center gap-2"
                  >
                    <ExternalLink size={14} />
                    Visit Website
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <section className="rounded-3xl bg-gray-50 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-400">About this company</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                  {companyPartner.about || userProfile.companyInfo?.about || 'No company description added yet.'}
                </p>
              </section>

              {posts.length > 0 && (
                <section className="space-y-3">
                  <p className="text-sm font-bold text-gray-900">Latest Highlights</p>
                  {posts.map((post) => (
                    <div key={post.id} className="rounded-3xl border border-gray-100 p-4">
                      <p className="text-xs text-gray-400 mb-2">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{post.content}</p>
                      {post.imageUrl && (
                        <CachedImage
                          src={post.imageUrl}
                          alt="company post"
                          fallbackMode="post"
                          loading="lazy"
                          decoding="async"
                          wrapperClassName="w-full mt-3 rounded-2xl"
                          imgClassName="w-full h-full rounded-2xl object-cover"
                        />
                      )}
                    </div>
                  ))}
                </section>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-gray-200 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-400">Company details</p>
                <div className="mt-4 space-y-3 text-sm text-gray-700">
                  <div className="flex items-start gap-3">
                    <MapPin size={16} className="mt-0.5 text-teal-700" />
                    <span>{companyPartner.location}</span>
                  </div>
                  {companyPartner.websiteUrl && (
                    <div className="flex items-start gap-3">
                      <Globe size={16} className="mt-0.5 text-teal-700" />
                      <a href={companyPartner.websiteUrl} target="_blank" rel="noopener noreferrer" className="break-all text-teal-700 hover:underline">
                        {companyPartner.websiteUrl}
                      </a>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <Copy size={16} className="mt-0.5 text-teal-700" />
                    <button onClick={handleCopyUserId} type="button" className="text-left text-teal-700 hover:underline">
                      {copiedId ? 'Copied company ID' : `Company ID: ${userProfile.publicId || userProfile.uid}`}
                    </button>
                  </div>
                </div>
              </div>

              {companyPartner.socialLinks.length > 0 && (
                <div className="rounded-3xl border border-gray-200 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-400">Social links</p>
                  <div className="mt-4 space-y-2">
                    {companyPartner.socialLinks.map((link) => (
                      <a
                        key={link}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-2xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-teal-50 hover:text-teal-700"
                      >
                        {link}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      </div>

      <div className="space-y-6">
        <div className="relative h-48 bg-gradient-to-r from-teal-600 to-emerald-600">
          {(editing ? draft.coverPhotoURL : userProfile.coverPhotoURL) && (
            <CachedImage
              src={(editing ? draft.coverPhotoURL : userProfile.coverPhotoURL) || ''}
              alt="cover"
              loading="lazy"
              decoding="async"
              wrapperClassName="w-full h-full"
              imgClassName="w-full h-full object-cover"
            />
          )}
          {isOwnProfile && editing && (
            <label className="absolute bottom-3 right-3 p-2 rounded-xl bg-black/30 text-white cursor-pointer">
              <Camera size={16} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUploadImage(e.target.files[0], 'coverPhotoURL')}
              />
            </label>
          )}
        </div>

        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative -mt-16">
              <CachedImage
                src={(editing ? draft.photoURL : userProfile.photoURL) || ''}
                alt={userProfile.displayName}
                fallbackMode="avatar"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                wrapperClassName="w-28 h-28 rounded-2xl border-4 border-white"
                imgClassName="w-full h-full rounded-2xl object-cover"
              />
              {isOwnProfile && editing && (
                <label className="absolute bottom-1 right-1 p-1.5 rounded-lg bg-black/30 text-white cursor-pointer">
                  <Camera size={14} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUploadImage(e.target.files[0], 'photoURL')}
                  />
                </label>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{editing ? draft.displayName : userProfile.displayName}</h2>
              <p className="text-sm text-gray-500 mt-1 capitalize">{userProfile.role}</p>
              <p className="text-xs text-gray-400 mt-1">Profile completion: {completion}%</p>
              <button
                onClick={handleCopyUserId}
                type="button"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg"
              >
                <Copy size={12} />
                {copiedId ? 'Copied' : `User ID: ${(editing ? draft.publicId : userProfile.publicId) || userProfile.uid}`}
              </button>
            </div>
            {isOwnProfile ? (
              <div className="flex gap-2">
                {!editing ? (
                  <button onClick={() => setEditing(true)} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-semibold text-sm">
                    Edit
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-teal-700 text-white hover:bg-teal-800 font-semibold text-sm inline-flex items-center gap-2"
                  >
                    <Save size={14} />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                )}
                <button
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200"
                >
                  <Share2 size={16} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => navigate(`/messages?uid=${userProfile.uid}`)} className="px-4 py-2 rounded-xl bg-teal-700 text-white hover:bg-teal-800 text-sm font-semibold inline-flex items-center gap-2">
                  <MessageSquare size={14} />
                  Message
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-4 border-b border-gray-100">
            {(['about', 'portfolio', 'activity'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`pb-3 text-sm font-bold capitalize ${tab === value ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-400'}`}
              >
                {value}
              </button>
            ))}
          </div>

          {tab === 'about' && (
            <div className="mt-6 space-y-7">
              <section className="space-y-4">
                <p className="text-sm font-bold text-gray-900">Personal Details</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <EditableField label="Display Name" value={editing ? draft.displayName : userProfile.displayName} editing={editing} onChange={(v) => setDraft((prev) => ({ ...prev, displayName: v }))} />
                  <EditableField label="Public User ID" value={editing ? draft.publicId : userProfile.publicId || userProfile.uid} editing={false} onChange={() => undefined} />
                  <EditableField label="Phone Number" value={editing ? draft.phoneNumber : userProfile.phoneNumber} editing={editing} onChange={(v) => setDraft((prev) => ({ ...prev, phoneNumber: v }))} />
                  <EditableField label="Status" value={editing ? draft.status : userProfile.status} editing={editing} onChange={(v) => setDraft((prev) => ({ ...prev, status: v }))} />
                </div>
              </section>

              <section className="space-y-4">
                <p className="text-sm font-bold text-gray-900">Location & Date Of Birth</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <EditableField label="Location" value={editing ? draft.location : userProfile.location} editing={editing} onChange={(v) => setDraft((prev) => ({ ...prev, location: v }))} />
                  <EditableField label="Date Of Birth" value={editing ? draft.dateOfBirth : userProfile.dateOfBirth} editing={editing} onChange={(v) => setDraft((prev) => ({ ...prev, dateOfBirth: v }))} inputType="date" />
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-gray-900">Skill</p>
                  {editing && (
                    <button onClick={handleAddSkill} className="px-2 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200">
                      <Plus size={12} />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(editing ? draft.skills : userProfile.skills || []).map((skill) => (
                    <span key={skill} className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-700 flex items-center gap-1">
                      {skill}
                      {editing && (
                        <button onClick={() => removeSkill(skill)}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </span>
                  ))}
                  {(!(editing ? draft.skills : userProfile.skills) || (editing ? draft.skills : userProfile.skills || []).length === 0) && (
                    <p className="text-sm text-gray-500">No skills added yet.</p>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <button
                  type="button"
                  onClick={() => setShowMoreDetails((prev) => !prev)}
                  className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                >
                  {showMoreDetails ? 'Hide details' : 'See more details'}
                </button>

                {showMoreDetails && (
                  <div className="space-y-6">
                    <section className="space-y-3">
                      <p className="text-sm font-bold text-gray-900">Experience</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Work history</span>
                        {editing && (
                          <button onClick={addExperience} className="px-2 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 inline-flex items-center gap-1">
                            <Plus size={12} />
                            Add
                          </button>
                        )}
                      </div>
                      {(editing ? draft.experience : userProfile.experience || []).map((exp, index) => (
                        <div key={index} className="p-3 rounded-xl border border-gray-100 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <EditableField label="Title" value={exp.title} editing={editing} onChange={(v) => updateExperience(index, 'title', v)} />
                            <EditableField label="Company" value={exp.company} editing={editing} onChange={(v) => updateExperience(index, 'company', v)} />
                            <EditableField label="Type" value={exp.type} editing={editing} onChange={(v) => updateExperience(index, 'type', v)} />
                            <EditableField label="Period" value={exp.period} editing={editing} onChange={(v) => updateExperience(index, 'period', v)} />
                          </div>
                          <EditableField label="Description" value={exp.description} editing={editing} textarea onChange={(v) => updateExperience(index, 'description', v)} />
                          {editing && (
                            <button onClick={() => removeExperience(index)} className="text-xs text-red-600 font-semibold">Remove</button>
                          )}
                        </div>
                      ))}
                      {(!(editing ? draft.experience : userProfile.experience) || (editing ? draft.experience : userProfile.experience || []).length === 0) && (
                        <p className="text-sm text-gray-500">No experience added yet.</p>
                      )}
                    </section>

                    <section className="space-y-3">
                      <p className="text-sm font-bold text-gray-900">Education</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <EditableField label="University" value={editing ? draft.education?.university : userProfile.education?.university} editing={editing} onChange={(v) => setDraft((prev) => ({ ...prev, education: { ...(prev.education || { university: '', degree: '', verified: false }), university: v } }))} />
                        <EditableField label="Degree" value={editing ? draft.education?.degree : userProfile.education?.degree} editing={editing} onChange={(v) => setDraft((prev) => ({ ...prev, education: { ...(prev.education || { university: '', degree: '', verified: false }), degree: v } }))} />
                        <EditableField label="Year" value={editing ? draft.education?.year : userProfile.education?.year} editing={editing} onChange={(v) => setDraft((prev) => ({ ...prev, education: { ...(prev.education || { university: '', degree: '', verified: false }), year: v } }))} />
                      </div>
                    </section>

                    <section className="space-y-3">
                      <p className="text-sm font-bold text-gray-900">Social Links</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <EditableField label="LinkedIn" value={editing ? draft.socialLinks?.linkedin : userProfile.socialLinks?.linkedin} editing={editing} onChange={(v) => setDraft((prev) => ({ ...prev, socialLinks: { ...(prev.socialLinks || {}), linkedin: v } }))} />
                        <EditableField label="GitHub" value={editing ? draft.socialLinks?.github : userProfile.socialLinks?.github} editing={editing} onChange={(v) => setDraft((prev) => ({ ...prev, socialLinks: { ...(prev.socialLinks || {}), github: v } }))} />
                        <EditableField label="Twitter" value={editing ? draft.socialLinks?.twitter : userProfile.socialLinks?.twitter} editing={editing} onChange={(v) => setDraft((prev) => ({ ...prev, socialLinks: { ...(prev.socialLinks || {}), twitter: v } }))} />
                        <EditableField label="Website" value={editing ? draft.socialLinks?.website : userProfile.socialLinks?.website} editing={editing} onChange={(v) => setDraft((prev) => ({ ...prev, socialLinks: { ...(prev.socialLinks || {}), website: v } }))} />
                      </div>
                    </section>

                    <section className="space-y-3">
                      <EditableField label="Bio" value={editing ? draft.bio : userProfile.bio} textarea editing={editing} onChange={(v) => setDraft((prev) => ({ ...prev, bio: v }))} />
                    </section>
                  </div>
                )}
              </section>
            </div>
          )}

          {tab === 'portfolio' && (
            <div className="mt-6 space-y-4">
              {editing && (
                <button onClick={addPortfolio} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold inline-flex items-center gap-2">
                  <Plus size={14} />
                  Add Portfolio Item
                </button>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(editing ? draft.portfolio : userProfile.portfolio || []).map((item, index) => (
                  <div key={index} className="p-4 border border-gray-100 rounded-2xl space-y-3">
                    <CachedImage
                      src={item.imageUrl || 'https://via.placeholder.com/600x400?text=Project'}
                      alt={item.title}
                      fallbackMode="media"
                      loading="lazy"
                      decoding="async"
                      wrapperClassName="w-full h-44 rounded-xl"
                      imgClassName="w-full h-full rounded-xl object-cover"
                    />
                    <EditableField label="Project Title" value={item.title} editing={editing} onChange={(v) => updatePortfolio(index, 'title', v)} />
                    <EditableField label="Project Link" value={item.link} editing={editing} onChange={(v) => updatePortfolio(index, 'link', v)} />
                    {editing && (
                      <>
                        <EditableField label="Image URL" value={item.imageUrl} editing={editing} onChange={(v) => updatePortfolio(index, 'imageUrl', v)} />
                        <label className="text-xs font-semibold text-teal-700 cursor-pointer">
                          Upload image
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPortfolioImage(e.target.files[0], index)} />
                        </label>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="space-y-3">
              {posts.length === 0 && <p className="text-sm text-gray-500">No activity yet.</p>}
              {posts.map((post) => (
                <div key={post.id} className="p-4 border border-gray-100 rounded-2xl">
                  <p className="text-xs text-gray-400 mb-2">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{post.content}</p>
                  {post.imageUrl && (
                    <CachedImage
                      src={post.imageUrl}
                      alt="post"
                      fallbackMode="post"
                      loading="lazy"
                      decoding="async"
                      wrapperClassName="w-full mt-3 rounded-xl"
                      imgClassName="w-full h-full rounded-xl object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <section className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-2 border-b border-gray-100 pb-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Bottom Section</p>
                <h3 className="mt-2 text-lg font-bold text-gray-900">All Posts</h3>
              </div>
              <p className="text-sm text-gray-500">
                {posts.length === 0 ? 'No posts published yet.' : `${posts.length} post${posts.length === 1 ? '' : 's'} from this profile`}
              </p>
            </div>

            {posts.length === 0 ? (
              <div className="rounded-3xl bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                This profile has not shared any posts yet.
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                {posts.map((post) => (
                  <article key={post.id} className="flex h-full flex-col rounded-3xl border border-gray-100 bg-gray-50/60 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700 shadow-sm">
                        {post.type}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm leading-7 text-gray-800 whitespace-pre-wrap">{post.content}</p>
                    {post.imageUrl && (
                      <CachedImage
                        src={post.imageUrl}
                        alt="post"
                        fallbackMode="post"
                        loading="lazy"
                        decoding="async"
                        wrapperClassName="mt-4 w-full overflow-hidden rounded-2xl"
                        imgClassName="h-full w-full rounded-2xl object-cover"
                      />
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function EditableField({
  label,
  value,
  editing,
  onChange,
  textarea = false,
  placeholder,
  inputType = 'text',
}: {
  label: string;
  value?: string;
  editing: boolean;
  onChange: (value: string) => void;
  textarea?: boolean;
  placeholder?: string;
  inputType?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wider font-bold text-gray-400">{label}</p>
      {editing ? (
        textarea ? (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-teal-500 min-h-[88px]"
          />
        ) : (
          <input
            type={inputType}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-teal-500"
          />
        )
      ) : (
        <p className="text-sm text-gray-800">{value || 'Not set'}</p>
      )}
    </div>
  );
}
