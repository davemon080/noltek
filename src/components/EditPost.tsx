import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Image, Loader2, X } from 'lucide-react';
import { UserProfile } from '../types';
import { supabaseService } from '../services/supabaseService';
import CachedImage from './CachedImage';

interface EditPostProps {
  profile: UserProfile;
}

export default function EditPost({ profile }: EditPostProps) {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!postId) return;
    supabaseService.getPostById(postId).then((post) => {
      if (!active) return;
      if (!post || post.authorUid !== profile.uid) {
        navigate('/');
        return;
      }
      setContent(post.content);
      setImageUrl(post.imageUrl || null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [navigate, postId, profile.uid]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!postId) return;
    if (!content.trim() && !imageUrl && !newImageFile) {
      setError('Post cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let nextImageUrl = imageUrl;
      if (newImageFile) {
        const upload = await supabaseService.uploadFile(newImageFile, 'posts');
        nextImageUrl = upload.url;
      }
      await supabaseService.updatePost(postId, {
        content: content.trim(),
        imageUrl: nextImageUrl || null,
      });
      navigate('/');
    } catch (submitError: any) {
      setError(submitError?.message || 'Failed to update post.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading post...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Post</h1>
          <p className="text-sm text-gray-500">Update your post and save it back to the feed.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={6}
          placeholder="Share an update..."
          className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm outline-none transition-all focus:border-teal-200 focus:bg-white focus:ring-2 focus:ring-teal-500"
        />

        {(imageUrl || newImageFile) && (
          <div className="relative overflow-hidden rounded-2xl border border-gray-200">
            <CachedImage
              src={newImageFile ? URL.createObjectURL(newImageFile) : imageUrl}
              alt="Post preview"
              wrapperClassName="max-h-80 w-full"
              imgClassName="max-h-80 w-full object-cover"
            />
            <button
              type="button"
              onClick={() => {
                setImageUrl(null);
                setNewImageFile(null);
              }}
              className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <Image size={16} />
            Change image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setNewImageFile(file);
              }}
            />
          </label>

          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-70">
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            Save Post
          </button>
        </div>

        {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      </form>
    </div>
  );
}
