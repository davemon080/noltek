import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CornerDownRight, Heart, Pencil, Send, Trash2, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Post, PostComment, PostCommentLike, UserProfile } from '../types';
import { supabaseService } from '../services/supabaseService';
import CachedImage from './CachedImage';
import { useConfirmDialog } from './ConfirmDialog';

interface CommentsProps {
  profile: UserProfile;
}

export default function Comments({ profile }: CommentsProps) {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentLikes, setCommentLikes] = useState<PostCommentLike[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [likingCommentIds, setLikingCommentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileByUid, setProfileByUid] = useState<Record<string, UserProfile>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const { confirm, confirmDialog } = useConfirmDialog();

  useEffect(() => {
    if (!postId) return;
    let active = true;
    Promise.all([supabaseService.getPostById(postId), supabaseService.listPostComments(postId)])
      .then(([postData, commentData]) => {
        if (!active) return;
        setPost(postData);
        setComments(commentData);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = supabaseService.subscribeToPostComments(postId, setComments);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [postId]);

  useEffect(() => {
    const commentIds = comments.map((comment) => comment.id);
    if (commentIds.length === 0) {
      setCommentLikes([]);
      return;
    }

    const unsubscribe = supabaseService.subscribeToPostCommentLikes(commentIds, setCommentLikes);
    return () => unsubscribe();
  }, [comments]);

  useEffect(() => {
    const uids = Array.from(
      new Set([
        ...(post ? [post.authorUid] : []),
        ...comments.map((comment) => comment.userUid),
      ])
    ).filter(Boolean);
    if (uids.length === 0) return;
    let active = true;
    supabaseService
      .getUsersByUids(uids)
      .then((profiles) => {
        if (!active) return;
        setProfileByUid((prev) => {
          const next = { ...prev };
          profiles.forEach((item) => {
            next[item.uid] = item;
          });
          return next;
        });
      })
      .catch(() => {
        // Keep current avatars if lookup fails.
      });
    return () => {
      active = false;
    };
  }, [comments, post]);

  const commentsByParent = useMemo(() => {
    return comments.reduce<Record<string, PostComment[]>>((acc, comment) => {
      const key = comment.parentCommentId || 'root';
      acc[key] = acc[key] || [];
      acc[key].push(comment);
      return acc;
    }, {});
  }, [comments]);

  const likeCountMap = useMemo(() => {
    return commentLikes.reduce<Record<string, number>>((acc, like) => {
      acc[like.commentId] = (acc[like.commentId] || 0) + 1;
      return acc;
    }, {});
  }, [commentLikes]);

  const likedCommentIds = useMemo(
    () => new Set(commentLikes.filter((item) => item.userUid === profile.uid).map((item) => item.commentId)),
    [commentLikes, profile.uid]
  );

  const allRepliesCount = comments.filter((comment) => comment.parentCommentId).length;
  const replyingToComment = replyingToId ? comments.find((comment) => comment.id === replyingToId) : null;

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postId || !newComment.trim()) return;
    setSubmitting(true);
    try {
      await supabaseService.addPostComment(postId, profile, newComment.trim(), replyingToId || undefined);
      setNewComment('');
      setReplyingToId(null);
    } catch {
      // Keep existing comments untouched if request fails.
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    if (likingCommentIds.includes(commentId)) return;
    const shouldLike = !likedCommentIds.has(commentId);
    const previousLikes = commentLikes;
    setLikingCommentIds((prev) => [...prev, commentId]);
    setCommentLikes((prev) => {
      const filtered = prev.filter((item) => !(item.commentId === commentId && item.userUid === profile.uid));
      if (!shouldLike) return filtered;
      return [
        ...filtered,
        {
          id: `temp-comment-like-${commentId}-${profile.uid}`,
          commentId,
          userUid: profile.uid,
          createdAt: new Date().toISOString(),
        },
      ];
    });

    try {
      await supabaseService.setPostCommentLike(commentId, profile.uid, shouldLike);
    } catch {
      setCommentLikes(previousLikes);
    } finally {
      setLikingCommentIds((prev) => prev.filter((id) => id !== commentId));
    }
  };

  const renderComment = (comment: PostComment, depth = 0): React.ReactNode => {
    const replies = commentsByParent[comment.id] || [];
    const displayProfile = profileByUid[comment.userUid];
    const isEditing = editingCommentId === comment.id;

    return (
      <div key={comment.id} className={`${depth > 0 ? 'ml-6 border-l border-gray-200 pl-4' : ''}`}>
        <div className="bg-white border border-gray-200 rounded-2xl p-3">
          <div className="flex items-start gap-3 mb-2">
            <CachedImage
              src={displayProfile?.photoURL || comment.authorPhoto}
              alt={comment.authorName}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              wrapperClassName="w-8 h-8 rounded-lg shrink-0"
              imgClassName="w-full h-full rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-gray-900">{comment.authorName}</p>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                </p>
              </div>
              {isEditing ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={editingContent}
                    onChange={(event) => setEditingContent(event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!editingContent.trim()) return;
                        await supabaseService.updatePostComment(comment.id, editingContent.trim());
                        setEditingCommentId(null);
                        setEditingContent('');
                      }}
                      className="rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCommentId(null);
                        setEditingContent('');
                      }}
                      className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{comment.content}</p>
              )}
              <div className="mt-3 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => handleToggleCommentLike(comment.id)}
                  disabled={likingCommentIds.includes(comment.id)}
                  className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${
                    likedCommentIds.has(comment.id) ? 'text-rose-600' : 'text-gray-500 hover:text-teal-700'
                  }`}
                >
                  <Heart size={13} className={likedCommentIds.has(comment.id) ? 'fill-current' : ''} />
                  {likeCountMap[comment.id] || 0}
                </button>
                <button
                  type="button"
                  onClick={() => setReplyingToId(comment.id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-teal-700 transition-colors"
                >
                  <CornerDownRight size={13} />
                  Reply
                </button>
                {comment.userUid === profile.uid && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCommentId(comment.id);
                        setEditingContent(comment.content);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-teal-700 transition-colors"
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = await confirm({
                          title: 'Delete this comment?',
                          description: 'This will permanently remove the comment from the discussion.',
                          confirmLabel: 'Delete',
                          tone: 'danger',
                        });
                        if (!confirmed) return;
                        await supabaseService.deletePostComment(comment.id);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-8 pb-40 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Comments</h1>
          <p className="text-xs text-gray-500">
            {comments.length} comment{comments.length === 1 ? '' : 's'}
            {allRepliesCount > 0 ? ` • ${allRepliesCount} repl${allRepliesCount === 1 ? 'y' : 'ies'}` : ''}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading comments...</div>
      ) : (
        <>
          {post && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <CachedImage
                  src={profileByUid[post.authorUid]?.photoURL || post.authorPhoto}
                  alt={post.authorName}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  wrapperClassName="w-9 h-9 rounded-lg"
                  imgClassName="w-full h-full rounded-lg object-cover"
                />
                <div>
                  <p className="text-sm font-bold text-gray-900">{post.authorName}</p>
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{post.content}</p>
            </div>
          )}

          <div className="space-y-3">
            {(commentsByParent.root || []).length === 0 ? (
              <div className="text-sm text-gray-500">No comments yet.</div>
            ) : (
              (commentsByParent.root || []).map((comment) => renderComment(comment))
            )}
          </div>
        </>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {replyingToComment && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl bg-teal-50 border border-teal-100 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-teal-700">
                  Replying to {replyingToComment.authorName}
                </p>
                <p className="text-xs text-teal-800 truncate">{replyingToComment.content}</p>
              </div>
              <button
                type="button"
                onClick={() => setReplyingToId(null)}
                className="p-1 text-teal-700 hover:text-teal-900"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmitComment} className="bg-white border border-gray-200 rounded-2xl p-3 flex items-end gap-2 shadow-sm">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyingToComment ? `Reply to ${replyingToComment.authorName}...` : 'Write a comment...'}
              className="flex-1 min-h-[72px] max-h-36 px-3 py-2 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm resize-none"
            />
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="px-3 py-2 rounded-xl bg-teal-700 text-white font-semibold text-sm hover:bg-teal-800 disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Send size={14} />
              {replyingToComment ? 'Reply' : 'Post'}
            </button>
          </form>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
