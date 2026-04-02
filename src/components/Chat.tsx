import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  CircleDollarSign,
  Download,
  FileIcon,
  Image as ImageIcon,
  Loader2,
  Lock,
  MessageSquare,
  MoreVertical,
  PlusSquare,
  Search,
  Send,
  X,
} from 'lucide-react';
import type { Attachment, Message, UserProfile } from '../types';
import { supabaseService } from '../services/supabaseService';
import CachedImage from './CachedImage';

interface ChatProps {
  profile: UserProfile;
}

type LocalMessage = Message & { localStatus?: 'pending' | 'sent' | 'failed' };

type ChatSummary = {
  otherUid: string;
  user: UserProfile;
  lastMessage: string;
  updatedAt: string;
};

type PresenceInfo = {
  userUid: string;
  onlineAt?: string;
  visibilityState?: string;
  typingTo?: string | null;
  viewingChatUid?: string | null;
  updatedAt?: string;
};

const LONG_PRESS_DELAY_MS = 520;

function mergeChatSummaries(incoming: ChatSummary[], existing: ChatSummary[] = []) {
  const map = new Map<string, ChatSummary>();
  [...incoming, ...existing].forEach((chat) => {
    if (!chat?.otherUid || !chat.user?.uid || !chat.user.displayName) return;
    const prev = map.get(chat.otherUid);
    if (!prev || new Date(chat.updatedAt || 0).getTime() >= new Date(prev.updatedAt || 0).getTime()) {
      map.set(chat.otherUid, chat);
    }
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
  );
}

function ensureDate(value?: string | Date | null) {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getPreviewText(message?: Pick<Message, 'content' | 'attachments'> | null) {
  if (!message) return '';
  const content = message.content?.trim();
  if (content) return content;
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return message.attachments.length > 1 ? 'Attachments' : 'Attachment';
  }
  return '';
}

function formatChatListTimestamp(dateValue?: string) {
  if (!dateValue) return '';
  const date = ensureDate(dateValue);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'dd/MM/yy');
}

function getSafeAttachments(message: LocalMessage): Attachment[] {
  if (!Array.isArray(message.attachments)) return [];
  return message.attachments.filter(
    (attachment): attachment is Attachment =>
      !!attachment &&
      typeof attachment.name === 'string' &&
      typeof attachment.type === 'string' &&
      typeof attachment.url === 'string' &&
      typeof attachment.size === 'number'
  );
}

function messagesMatchOptimistic(local: LocalMessage, server: Message) {
  return (
    local.id.startsWith('temp-') &&
    local.senderUid === server.senderUid &&
    local.receiverUid === server.receiverUid &&
    local.content === server.content &&
    Math.abs(new Date(local.createdAt).getTime() - new Date(server.createdAt).getTime()) < 10000
  );
}

function mergeServerConversation(existing: LocalMessage[], serverMessages: Message[]) {
  const serverLocals: LocalMessage[] = serverMessages.map((message) => ({
    ...message,
    localStatus: 'sent' as const,
  }));
  const leftovers = existing.filter((message) => {
    if (message.localStatus === 'failed') return true;
    if (!message.id.startsWith('temp-')) return false;
    return !serverMessages.some((serverMessage) => messagesMatchOptimistic(message, serverMessage));
  });
  const merged = new Map<string, LocalMessage>();
  [...serverLocals, ...leftovers].forEach((message) => merged.set(message.id, message));
  return Array.from(merged.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function upsertRealtimeMessage(existing: LocalMessage[], incoming: Message, currentUid: string, otherUid: string) {
  const belongs =
    (incoming.senderUid === currentUid && incoming.receiverUid === otherUid) ||
    (incoming.senderUid === otherUid && incoming.receiverUid === currentUid);
  if (!belongs) return existing;

  const existingIndex = existing.findIndex((message) => message.id === incoming.id);
  if (existingIndex >= 0) {
    const next = [...existing];
    next[existingIndex] = { ...next[existingIndex], ...incoming, localStatus: 'sent' };
    return next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  const withoutTempDuplicate = existing.filter((message) => !messagesMatchOptimistic(message, incoming));
  return [...withoutTempDuplicate, { ...incoming, localStatus: 'sent' as const }].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function getOutgoingReceiptState(message: LocalMessage, otherUserOnline: boolean) {
  if (message.localStatus === 'pending') return 'pending';
  if (message.localStatus === 'failed') return 'failed';
  if (message.readAt) return 'read';
  if (otherUserOnline) return 'delivered';
  return 'sent';
}

export default function Chat({ profile }: ChatProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetUid = searchParams.get('uid');

  const [isMobileLayout, setIsMobileLayout] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = React.useState(false);
  const [messagesError, setMessagesError] = React.useState<string | null>(null);
  const [activeChats, setActiveChats] = React.useState<ChatSummary[]>([]);
  const [messages, setMessages] = React.useState<LocalMessage[]>([]);
  const [allUsers, setAllUsers] = React.useState<UserProfile[]>([]);
  const [selectedContact, setSelectedContact] = React.useState<UserProfile | null>(null);
  const [showChatOnMobile, setShowChatOnMobile] = React.useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = React.useState('');
  const [newChatSearchQuery, setNewChatSearchQuery] = React.useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [activeUploads, setActiveUploads] = React.useState(0);
  const [showAttachmentMenu, setShowAttachmentMenu] = React.useState(false);
  const [newMessage, setNewMessage] = React.useState('');
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [chatActionsUser, setChatActionsUser] = React.useState<UserProfile | null>(null);
  const [messageActionsMessage, setMessageActionsMessage] = React.useState<LocalMessage | null>(null);
  const [onlineUserIds, setOnlineUserIds] = React.useState<Set<string>>(new Set());
  const [presenceState, setPresenceState] = React.useState<Record<string, PresenceInfo>>({});
  const [unreadCounts, setUnreadCounts] = React.useState<Record<string, number>>({});
  const [composerHeight, setComposerHeight] = React.useState(88);
  const [keyboardInset, setKeyboardInset] = React.useState(0);
  const [inputFocused, setInputFocused] = React.useState(false);

  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const composerRef = React.useRef<HTMLDivElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const attachmentMenuRef = React.useRef<HTMLDivElement>(null);
  const initialLoadRef = React.useRef(true);
  const holdTimeoutRef = React.useRef<number | null>(null);
  const typingTimeoutRef = React.useRef<number | null>(null);

  const uploading = activeUploads > 0;
  const selectedContactPresence = selectedContact ? presenceState[selectedContact.uid] : undefined;
  const selectedContactOnline = selectedContact ? onlineUserIds.has(selectedContact.uid) : false;
  const selectedContactTyping = selectedContactPresence?.typingTo === profile.uid;
  const conversationBottomPadding = composerHeight + keyboardInset + 32;

  const filteredActiveChats = React.useMemo(() => {
    const query = sidebarSearchQuery.trim().toLowerCase();
    if (!query) return activeChats;
    return activeChats.filter(
      (chat) =>
        chat.user.displayName.toLowerCase().includes(query) ||
        String(chat.lastMessage || '').toLowerCase().includes(query)
    );
  }, [activeChats, sidebarSearchQuery]);

  const filteredNewChatUsers = React.useMemo(() => {
    const query = newChatSearchQuery.trim().toLowerCase();
    if (!query) return allUsers;
    return allUsers.filter(
      (user) =>
        user.displayName.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query) ||
        (user.publicId || '').toLowerCase().includes(query)
    );
  }, [allUsers, newChatSearchQuery]);

  const findKnownUser = React.useCallback(
    (uid: string) => {
      if (selectedContact?.uid === uid) return selectedContact;
      const chatUser = activeChats.find((chat) => chat.otherUid === uid)?.user;
      if (chatUser) return chatUser;
      const modalUser = allUsers.find((user) => user.uid === uid);
      if (modalUser) return modalUser;
      return supabaseService.profileCache.get(uid) || null;
    },
    [activeChats, allUsers, selectedContact]
  );

  const focusInput = React.useCallback(() => {
    window.setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      const cursor = input.value.length;
      input.setSelectionRange(cursor, cursor);
    }, 24);
  }, []);

  const updateChatRow = React.useCallback((otherUid: string, user: UserProfile, lastMessage: string, updatedAt: string) => {
    setActiveChats((prev) => mergeChatSummaries([{ otherUid, user, lastMessage, updatedAt }], prev));
  }, []);

  const clearUnreadForChat = React.useCallback((otherUid: string) => {
    setUnreadCounts((prev) => {
      if (!prev[otherUid]) return prev;
      const next = { ...prev };
      delete next[otherUid];
      return next;
    });
  }, []);

  const updateUnreadForChat = React.useCallback((otherUid: string, updater: (current: number) => number) => {
    setUnreadCounts((prev) => {
      const nextValue = Math.max(0, updater(prev[otherUid] || 0));
      if (nextValue === 0) {
        if (!prev[otherUid]) return prev;
        const next = { ...prev };
        delete next[otherUid];
        return next;
      }
      return { ...prev, [otherUid]: nextValue };
    });
  }, []);

  const closeConversation = React.useCallback(
    (replaceHistory: boolean = false) => {
      setSelectedContact(null);
      setShowChatOnMobile(false);
      setMessages([]);
      setMessagesError(null);
      setEditingMessageId(null);
      setSelectedFiles([]);
      setShowAttachmentMenu(false);
      setSearchParams({}, { replace: true });
      navigate('/messages', { replace: replaceHistory });
    },
    [navigate, setSearchParams]
  );

  const openConversation = React.useCallback(
    (
      user: UserProfile,
      options?: { otherUid?: string; lastMessage?: string; updatedAt?: string; syncUrl?: boolean }
    ) => {
      const otherUid = options?.otherUid || user.uid;
      setSelectedContact(user);
      setShowChatOnMobile(true);
      updateChatRow(otherUid, user, options?.lastMessage || '', options?.updatedAt || new Date().toISOString());
      clearUnreadForChat(otherUid);
      setMessagesError(null);
      setEditingMessageId(null);
      setSelectedFiles([]);
      if (options?.syncUrl !== false) {
        setSearchParams({ uid: otherUid });
      }
      supabaseService.markMessagesAsRead(profile.uid, otherUid).catch(() => undefined);
    },
    [clearUnreadForChat, profile.uid, setSearchParams, updateChatRow]
  );

  const adjustComposerHeight = React.useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = '0px';
    input.style.height = `${Math.min(input.scrollHeight, 168)}px`;
  }, []);

  const removeFile = React.useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  }, []);

  const cancelHold = React.useCallback(() => {
    if (holdTimeoutRef.current) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  }, []);

  const beginHold = React.useCallback(
    (action: () => void) => {
      cancelHold();
      holdTimeoutRef.current = window.setTimeout(() => {
        action();
        holdTimeoutRef.current = null;
      }, LONG_PRESS_DELAY_MS);
    },
    [cancelHold]
  );

  const goToPayUser = React.useCallback(
    (user: UserProfile) => {
      const params = new URLSearchParams({
        recipient: encodeURIComponent(user.publicId || user.uid),
        name: encodeURIComponent(user.displayName),
      });
      setChatActionsUser(null);
      navigate(`/wallets/transfer/details?${params.toString()}`);
    },
    [navigate]
  );

  const handleFileSelect = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const files = Array.from(event.target.files);
    setSelectedFiles((prev) => [...prev, ...files]);
    event.target.value = '';
    focusInput();
  }, [focusInput]);

  const handleEditMessage = React.useCallback(
    (message: LocalMessage) => {
      if (message.senderUid !== profile.uid || message.isDeleted) return;
      setEditingMessageId(message.id);
      setNewMessage(message.content);
      setMessageActionsMessage(null);
      focusInput();
    },
    [focusInput, profile.uid]
  );

  const handleDeleteMessage = React.useCallback(
    async (message: LocalMessage) => {
      if (message.senderUid !== profile.uid || message.isDeleted) return;
      try {
        await supabaseService.deleteMessage(message.id, profile.uid);
        if (editingMessageId === message.id) {
          setEditingMessageId(null);
          setNewMessage('');
        }
        setMessageActionsMessage(null);
      } catch (nextError) {
        console.error('Error deleting message:', nextError);
        setError('Failed to delete message.');
      }
    },
    [editingMessageId, profile.uid]
  );

  const handleClearCurrentChat = React.useCallback(async () => {
    if (!selectedContact) return;
    try {
      await supabaseService.clearConversation(profile.uid, selectedContact.uid);
      setChatActionsUser(null);
      closeConversation(true);
    } catch (nextError) {
      console.error('Error clearing chat:', nextError);
      setError('Failed to clear chat.');
    }
  }, [closeConversation, profile.uid, selectedContact]);

  const handleSendMessage = React.useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      if (!selectedContact) return;

      const trimmedMessage = newMessage.trim();
      const files = [...selectedFiles];
      if (!trimmedMessage && files.length === 0) return;

      if (editingMessageId) {
        try {
          await supabaseService.updateMessage(editingMessageId, profile.uid, trimmedMessage);
          setEditingMessageId(null);
          setNewMessage('');
          focusInput();
        } catch (nextError) {
          console.error('Error editing message:', nextError);
          setError('Failed to update message.');
        }
        return;
      }

      if (files.length > 0 && uploading) return;

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const createdAt = new Date().toISOString();
      const optimisticMessage: LocalMessage = {
        id: tempId,
        senderUid: profile.uid,
        receiverUid: selectedContact.uid,
        content: trimmedMessage,
        createdAt,
        attachments: files.map((file) => ({
          name: file.name,
          url: '',
          type: file.type,
          size: file.size,
        })),
        localStatus: 'pending',
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      updateChatRow(
        selectedContact.uid,
        selectedContact,
        trimmedMessage || (files.length > 1 ? 'Attachments' : files.length > 0 ? 'Attachment' : ''),
        createdAt
      );
      setNewMessage('');
      setSelectedFiles([]);
      supabaseService.setPresenceTyping(null);
      focusInput();

      if (files.length > 0) {
        setActiveUploads((prev) => prev + 1);
      }

      try {
        const attachments = files.length > 0 ? await Promise.all(files.map((file) => supabaseService.uploadFile(file))) : [];
        const sentMessage = await supabaseService.sendMessage({
          senderUid: profile.uid,
          receiverUid: selectedContact.uid,
          content: trimmedMessage,
          attachments: attachments.length > 0 ? attachments : undefined,
        });

        setMessages((prev) => upsertRealtimeMessage(prev, sentMessage, profile.uid, selectedContact.uid));
        updateChatRow(selectedContact.uid, selectedContact, getPreviewText(sentMessage), sentMessage.createdAt);
      } catch (nextError) {
        console.error('Error sending message:', nextError);
        setError(files.length > 0 ? 'Failed to send message with attachments.' : 'Failed to send message.');
        setMessages((prev) =>
          prev.map((message) =>
            message.id === tempId
              ? {
                  ...message,
                  localStatus: 'failed',
                }
              : message
          )
        );
        if (trimmedMessage && !newMessage) {
          setNewMessage(trimmedMessage);
          focusInput();
        }
      } finally {
        if (files.length > 0) {
          setActiveUploads((prev) => Math.max(0, prev - 1));
        }
      }
    },
    [
      editingMessageId,
      focusInput,
      newMessage,
      profile.uid,
      selectedContact,
      selectedFiles,
      updateChatRow,
      uploading,
    ]
  );

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobileLayout(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    adjustComposerHeight();
  }, [adjustComposerHeight, newMessage]);

  React.useEffect(() => {
    const composerElement = composerRef.current;
    if (!composerElement || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      setComposerHeight(entry.contentRect.height);
    });
    observer.observe(composerElement);
    return () => observer.disconnect();
  }, [editingMessageId, selectedContact, selectedFiles.length, newMessage]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const viewport = window.visualViewport;
    const updateInset = () => {
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const inset = Math.max(0, window.innerHeight - viewportHeight - offsetTop);
      setKeyboardInset(inset > 80 ? inset : 0);
    };

    updateInset();
    window.addEventListener('resize', updateInset);
    viewport?.addEventListener('resize', updateInset);
    viewport?.addEventListener('scroll', updateInset);

    return () => {
      window.removeEventListener('resize', updateInset);
      viewport?.removeEventListener('resize', updateInset);
      viewport?.removeEventListener('scroll', updateInset);
    };
  }, []);

  React.useEffect(() => supabaseService.subscribeToOnlineUsers((uids) => setOnlineUserIds(new Set(uids))), []);
  React.useEffect(() => supabaseService.subscribeToPresenceState((state) => setPresenceState(state)), []);
  React.useEffect(() => supabaseService.subscribeToUnreadMessageCounts(profile.uid, setUnreadCounts), [profile.uid]);

  React.useEffect(() => {
    const unsubscribe = supabaseService.subscribeToActiveChats(
      profile.uid,
      async (chats) => {
        try {
          const recent = await supabaseService.getRecentConversations(profile.uid);
          setActiveChats(mergeChatSummaries(chats, recent));
          setError(null);
        } catch {
          setActiveChats(mergeChatSummaries(chats));
        } finally {
          setLoading(false);
        }
      },
      (nextError) => {
        console.error('Chat subscription error:', nextError);
        setError('Failed to load conversations. Please check your connection.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile.uid]);

  React.useEffect(() => {
    if (!targetUid) {
      setSelectedContact(null);
      setShowChatOnMobile(false);
      initialLoadRef.current = false;
      return;
    }

    if (selectedContact?.uid === targetUid) return;

    const knownChat = activeChats.find((chat) => chat.otherUid === targetUid);
    if (knownChat) {
      openConversation(knownChat.user, { ...knownChat, syncUrl: false });
      initialLoadRef.current = false;
      return;
    }

    if (!initialLoadRef.current && selectedContact) return;

    let cancelled = false;
    supabaseService
      .getUserProfile(targetUid)
      .then((user) => {
        if (!cancelled && user) {
          openConversation(user, {
            otherUid: user.uid,
            lastMessage: '',
            updatedAt: new Date().toISOString(),
            syncUrl: false,
          });
        }
      })
      .catch((nextError) => {
        console.error('Error loading target user:', nextError);
        if (!cancelled) setError('Failed to load that conversation.');
      })
      .finally(() => {
        initialLoadRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [activeChats, openConversation, selectedContact, targetUid]);

  React.useEffect(() => {
    if (!isNewChatModalOpen) return;
    supabaseService.getFriends(profile.uid).then(setAllUsers).catch(() => undefined);
  }, [isNewChatModalOpen, profile.uid]);

  React.useEffect(() => {
    return supabaseService.subscribeToMessageEvents(profile.uid, async ({ type, message }) => {
      if (!message || type === 'DELETE') return;

      const otherUid = message.senderUid === profile.uid ? message.receiverUid : message.senderUid;
      const user = findKnownUser(otherUid) || (await supabaseService.getUserProfile(otherUid).catch(() => null));
      if (user) {
        updateChatRow(otherUid, user, getPreviewText(message), message.createdAt);
      }

      if (selectedContact) {
        setMessages((prev) => upsertRealtimeMessage(prev, message, profile.uid, selectedContact.uid));
      }

      const conversationOpen = selectedContact?.uid === otherUid && (!isMobileLayout || showChatOnMobile);
      if (message.receiverUid === profile.uid) {
        if (conversationOpen) {
          clearUnreadForChat(otherUid);
          supabaseService.markMessagesAsRead(profile.uid, otherUid).catch(() => undefined);
        } else {
          updateUnreadForChat(otherUid, (current) => current + 1);
        }
      }
    });
  }, [
    clearUnreadForChat,
    findKnownUser,
    isMobileLayout,
    profile.uid,
    selectedContact,
    showChatOnMobile,
    updateChatRow,
    updateUnreadForChat,
  ]);

  React.useEffect(() => {
    if (!selectedContact) {
      setMessages([]);
      setMessagesError(null);
      setMessagesLoading(false);
      return;
    }

    setMessagesLoading(true);
    setMessagesError(null);
    const unsubscribe = supabaseService.subscribeToMessages(
      profile.uid,
      selectedContact.uid,
      (serverMessages) => {
        setMessages((prev) => mergeServerConversation(prev, serverMessages));
        setMessagesLoading(false);
        const latest = serverMessages[serverMessages.length - 1];
        if (latest) {
          updateChatRow(selectedContact.uid, selectedContact, getPreviewText(latest), latest.createdAt);
        }
      },
      (nextError) => {
        console.error('Messages subscription error:', nextError);
        setMessagesError('Failed to load messages. Please check your connection.');
        setMessagesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile.uid, selectedContact, updateChatRow]);

  React.useEffect(() => {
    if (!selectedContact) return;
    clearUnreadForChat(selectedContact.uid);
    supabaseService.markMessagesAsRead(profile.uid, selectedContact.uid).catch(() => undefined);
  }, [clearUnreadForChat, messages.length, profile.uid, selectedContact]);

  React.useEffect(() => {
    if (!selectedContact || (isMobileLayout && !showChatOnMobile)) {
      supabaseService.setPresenceViewingChat(null);
      return;
    }

    supabaseService.setPresenceViewingChat(selectedContact.uid);
    return () => {
      supabaseService.setPresenceViewingChat(null);
    };
  }, [isMobileLayout, selectedContact, showChatOnMobile]);

  React.useEffect(() => {
    if (!selectedContact) {
      supabaseService.setPresenceTyping(null);
      return;
    }

    if (!newMessage.trim()) {
      supabaseService.setPresenceTyping(null);
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      return;
    }

    supabaseService.setPresenceTyping(selectedContact.uid);
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      supabaseService.setPresenceTyping(null);
      typingTimeoutRef.current = null;
    }, 1200);

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [newMessage, selectedContact]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [inputFocused, keyboardInset, messages, selectedContact?.uid, selectedContactTyping]);

  React.useEffect(() => {
    if (!showAttachmentMenu) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!attachmentMenuRef.current?.contains(event.target as Node)) {
        setShowAttachmentMenu(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showAttachmentMenu]);

  React.useEffect(() => cancelHold, [cancelHold]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center rounded-[2rem] border border-gray-200 bg-white">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto animate-spin text-teal-600" />
          <p className="mt-3 text-sm font-medium text-gray-500">Loading conversations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-[2rem] border border-red-200 bg-white p-6 text-center">
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-red-700">
          <p className="font-bold">Something went wrong</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-2xl bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm md:h-screen">
      <aside
        className={`${
          showChatOnMobile ? 'hidden md:flex' : 'flex'
        } w-full flex-col border-r border-gray-200 bg-white md:w-[24rem] md:max-w-[24rem]`}
      >
        <div className="border-b border-gray-100 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Messages</h1>
              <p className="text-xs text-gray-500">Realtime chats, unread badges, and quick actions.</p>
            </div>
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 transition-all hover:bg-teal-100"
              aria-label="Start new chat"
            >
              <PlusSquare size={20} />
            </button>
          </div>
          <div className="relative mt-4">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={sidebarSearchQuery}
              onChange={(event) => setSidebarSearchQuery(event.target.value)}
              placeholder="Search messages"
              className="w-full rounded-2xl border border-transparent bg-gray-100 py-3 pl-10 pr-4 text-sm transition-all focus:border-teal-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          {filteredActiveChats.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 text-gray-300">
                <MessageSquare size={30} />
              </div>
              <p className="mt-4 text-sm font-semibold text-gray-900">No chats yet</p>
              <p className="mt-1 text-xs text-gray-500">Start a new conversation with one of your connections.</p>
              <button
                onClick={() => setIsNewChatModalOpen(true)}
                className="mt-5 rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800"
              >
                Start New Chat
              </button>
            </div>
          ) : (
            filteredActiveChats.map((chat) => {
              const unread = unreadCounts[chat.otherUid] || 0;
              const typing = presenceState[chat.otherUid]?.typingTo === profile.uid;
              const active = selectedContact?.uid === chat.otherUid;
              return (
                <button
                  key={chat.otherUid}
                  type="button"
                  onClick={() => openConversation(chat.user, chat)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setChatActionsUser(chat.user);
                  }}
                  onTouchStart={() => beginHold(() => setChatActionsUser(chat.user))}
                  onTouchEnd={cancelHold}
                  onTouchMove={cancelHold}
                  onTouchCancel={cancelHold}
                  className={`flex w-full select-none items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition-all ${
                    active ? 'bg-teal-50/70' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="relative">
                    <CachedImage
                      src={chat.user.photoURL}
                      alt={chat.user.displayName}
                      wrapperClassName="h-14 w-14 rounded-2xl border border-gray-200 bg-gray-100"
                      imgClassName="h-full w-full rounded-2xl object-cover"
                    />
                    {onlineUserIds.has(chat.user.uid) && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-bold text-gray-900">{chat.user.displayName}</p>
                      <span className="shrink-0 text-[10px] font-medium text-gray-400">
                        {formatChatListTimestamp(chat.updatedAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p className={`truncate text-xs font-medium ${typing ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {typing ? 'Typing...' : chat.lastMessage || chat.user.role}
                      </p>
                      {unread > 0 && (
                        <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className={`${showChatOnMobile ? 'flex' : 'hidden md:flex'} relative min-h-0 flex-1 flex-col bg-[#efeae2]`}>
        {selectedContact ? (
          <>
            <header className="flex flex-none items-center justify-between border-b border-gray-200 bg-[#f0f2f5] px-4 py-3 shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  onClick={() => closeConversation(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition-all hover:bg-gray-100"
                  aria-label="Back to messages"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="relative">
                  <CachedImage
                    src={selectedContact.photoURL}
                    alt={selectedContact.displayName}
                    wrapperClassName="h-11 w-11 rounded-2xl border border-gray-200 bg-white"
                    imgClassName="h-full w-full rounded-2xl object-cover"
                  />
                  {selectedContactOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                  )}
                </div>
                <button type="button" onClick={() => navigate(`/profile/${selectedContact.uid}`)} className="min-w-0 text-left">
                  <p className="truncate text-sm font-black text-gray-900">{selectedContact.displayName}</p>
                  <p className={`truncate text-[10px] font-bold uppercase tracking-wider ${selectedContactTyping || selectedContactOnline ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {selectedContactTyping ? 'Typing...' : selectedContactOnline ? 'Online now' : 'Offline'}
                  </p>
                </button>
              </div>
              <button
                onClick={() => setChatActionsUser(selectedContact)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-all hover:bg-gray-100"
                aria-label="Chat actions"
              >
                <MoreVertical size={20} />
              </button>
            </header>

            <div className="relative min-h-0 flex-1">
              <div
                className="absolute inset-0 overflow-y-auto px-3 py-4 md:px-6 md:py-5"
                style={{
                  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.05) 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                  paddingBottom: `${conversationBottomPadding}px`,
                  WebkitTouchCallout: 'none',
                }}
              >
                {messagesLoading ? (
                  <div className="space-y-4 p-6">
                    {[0, 1, 2, 3].map((item) => (
                      <div key={item} className={`flex animate-pulse ${item % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                        <div className={`h-12 w-2/3 rounded-2xl bg-white/60 ${item % 2 === 0 ? 'rounded-tr-none' : 'rounded-tl-none'}`} />
                      </div>
                    ))}
                  </div>
                ) : messagesError ? (
                  <div className="flex h-full items-center justify-center p-6">
                    <div className="max-w-xs rounded-3xl bg-white/90 p-6 text-center shadow-sm">
                      <p className="text-sm font-bold text-red-600">Failed to load messages</p>
                      <p className="mt-2 text-sm text-gray-600">{messagesError}</p>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center p-6">
                    <div className="max-w-xs rounded-3xl bg-white/85 p-5 text-center shadow-sm">
                      <p className="text-xs font-medium text-gray-500">
                        Messages are end-to-end encrypted. No one outside of this chat, not even Connect, can read them.
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const isMine = message.senderUid === profile.uid;
                    const date = ensureDate(message.createdAt);
                    const previousDate = index > 0 ? ensureDate(messages[index - 1].createdAt) : null;
                    const showDateHeader =
                      !previousDate || format(previousDate, 'yyyy-MM-dd') !== format(date, 'yyyy-MM-dd');
                    const attachments = getSafeAttachments(message);
                    const receiptState = getOutgoingReceiptState(message, selectedContactOnline);

                    return (
                      <React.Fragment key={message.id}>
                        {showDateHeader && (
                          <div className="my-4 flex justify-center">
                            <span className="rounded-full border border-white/70 bg-white/85 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 shadow-sm">
                              {isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'MMMM d, yyyy')}
                            </span>
                          </div>
                        )}
                        <motion.div
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`mb-1 flex ${isMine ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`relative max-w-[86%] select-none rounded-3xl px-3 py-2 text-sm shadow-sm md:max-w-[70%] ${
                              isMine ? 'rounded-tr-md bg-[#dcf8c6] text-gray-900' : 'rounded-tl-md bg-white text-gray-900'
                            }`}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              setMessageActionsMessage(message);
                            }}
                            onTouchStart={() => beginHold(() => setMessageActionsMessage(message))}
                            onTouchEnd={cancelHold}
                            onTouchMove={cancelHold}
                            onTouchCancel={cancelHold}
                          >
                            <span
                              className={`absolute top-0 h-2 w-2 ${
                                isMine
                                  ? '-right-1 bg-[#dcf8c6] [clip-path:polygon(0_0,0_100%,100%_0)]'
                                  : '-left-1 bg-white [clip-path:polygon(100%_0,100%_100%,0_0)]'
                              }`}
                            />
                            {attachments.length > 0 && (
                              <div className="mb-2 space-y-2">
                                {attachments.map((attachment, attachmentIndex) => {
                                  const isImage = attachment.type.startsWith('image/');
                                  return (
                                    <div key={`${message.id}-${attachmentIndex}`} className="overflow-hidden rounded-2xl border border-black/5 bg-black/5">
                                      {isImage ? (
                                        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
                                          <CachedImage
                                            src={attachment.url}
                                            alt={attachment.name}
                                            wrapperClassName="max-h-72 w-full"
                                            imgClassName="max-h-72 w-full object-contain"
                                          />
                                        </a>
                                      ) : (
                                        <a
                                          href={attachment.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-3 p-3 transition-colors hover:bg-black/10"
                                        >
                                          <div className="rounded-xl bg-white p-2 shadow-sm">
                                            <FileIcon size={18} className="text-teal-600" />
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs font-bold">{attachment.name}</p>
                                            <p className="text-[10px] text-gray-500">{(attachment.size / 1024).toFixed(1)} KB</p>
                                          </div>
                                          <Download size={14} className="text-gray-400" />
                                        </a>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {message.content && (
                              <p className={`whitespace-pre-wrap pr-12 leading-relaxed ${message.isDeleted ? 'italic text-gray-500' : ''}`}>
                                {message.content}
                              </p>
                            )}
                            <div className="absolute bottom-1 right-2 flex items-center gap-1">
                              <span className="text-[9px] font-medium text-gray-500">{format(date, 'HH:mm')}</span>
                              {isMine && <ReceiptIcon state={receiptState} />}
                            </div>
                          </div>
                        </motion.div>
                      </React.Fragment>
                    );
                  })
                )}

                {selectedContactTyping && (
                  <div className="mb-1 flex justify-start">
                    <div className="relative rounded-2xl rounded-tl-md bg-white px-3 py-2 shadow-sm">
                      <span className="-left-1 absolute top-0 h-2 w-2 bg-white [clip-path:polygon(100%_0,100%_100%,0_0)]" />
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.2s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.1s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div
                ref={composerRef}
                className="absolute inset-x-0 z-20 border-t border-gray-200 bg-[#f0f2f5] px-3 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] transition-[bottom,transform] duration-200 ease-out"
                style={{
                  bottom: keyboardInset,
                  paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
                  transform: inputFocused || keyboardInset > 0 ? 'translateY(-6px)' : 'translateY(0)',
                }}
              >
                {selectedFiles.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2 rounded-2xl bg-white/80 p-2">
                    {selectedFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="relative">
                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 text-center shadow-sm">
                          {file.type.startsWith('image/') ? (
                            <CachedImage
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              wrapperClassName="h-full w-full rounded-xl"
                              imgClassName="h-full w-full rounded-xl object-cover"
                            />
                          ) : (
                            <div>
                              <FileIcon size={22} className="mx-auto text-teal-600" />
                              <p className="mt-1 line-clamp-2 text-[8px] font-bold text-gray-700">{file.name}</p>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                  <div className="flex items-center gap-1">
                    <div className="relative" ref={attachmentMenuRef}>
                      <button
                        type="button"
                        onClick={() => setShowAttachmentMenu((prev) => !prev)}
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                          showAttachmentMenu ? 'bg-teal-50 text-teal-600' : 'text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        <PlusSquare size={22} />
                      </button>

                      <AnimatePresence>
                        {showAttachmentMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.96 }}
                            className="absolute bottom-full left-0 mb-3 min-w-[200px] rounded-3xl border border-gray-100 bg-white p-2 shadow-xl"
                          >
                            <AttachmentMenuButton
                              icon={<ImageIcon size={18} />}
                              iconClassName="bg-pink-50 text-pink-600"
                              label="Camera"
                              onClick={() => {
                                fileInputRef.current?.setAttribute('accept', 'image/*');
                                fileInputRef.current?.setAttribute('capture', 'environment');
                                fileInputRef.current?.click();
                                setShowAttachmentMenu(false);
                              }}
                            />
                            <AttachmentMenuButton
                              icon={<ImageIcon size={18} />}
                              iconClassName="bg-blue-50 text-blue-600"
                              label="Photos & Videos"
                              onClick={() => {
                                fileInputRef.current?.removeAttribute('capture');
                                fileInputRef.current?.setAttribute('accept', 'image/*');
                                fileInputRef.current?.click();
                                setShowAttachmentMenu(false);
                              }}
                            />
                            <AttachmentMenuButton
                              icon={<FileIcon size={18} />}
                              iconClassName="bg-purple-50 text-purple-600"
                              label="Documents"
                              onClick={() => {
                                fileInputRef.current?.removeAttribute('capture');
                                fileInputRef.current?.setAttribute('accept', '.pdf,.doc,.docx,.txt,.zip');
                                fileInputRef.current?.click();
                                setShowAttachmentMenu(false);
                              }}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                  </div>

                  <div className="relative flex-1 rounded-[1.75rem] bg-white shadow-sm">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      onFocus={() => {
                        setInputFocused(true);
                        window.setTimeout(() => {
                          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        }, 120);
                      }}
                      onBlur={() => {
                        window.setTimeout(() => setInputFocused(false), 120);
                      }}
                      placeholder={editingMessageId ? 'Edit your message' : 'Type a message'}
                      autoComplete="off"
                      autoCorrect="on"
                      spellCheck
                      enterKeyHint="send"
                      className="max-h-40 w-full resize-none overflow-y-auto rounded-[1.75rem] border-transparent bg-transparent px-4 py-3 text-[15px] text-gray-900 caret-teal-600 focus:outline-none focus:ring-0"
                    />
                  </div>

                  {(newMessage.trim() || selectedFiles.length > 0) && (
                    <button
                      type="submit"
                      disabled={uploading}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-white shadow-md transition-all hover:bg-teal-700 disabled:bg-gray-400"
                    >
                      {uploading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                  )}
                </form>

                {editingMessageId && (
                  <div className="mt-2 flex items-center justify-between rounded-2xl bg-white px-4 py-2 text-xs text-gray-600 shadow-sm">
                    <span>Editing message</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMessageId(null);
                        setNewMessage('');
                      }}
                      className="font-bold text-red-600"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/80 shadow-2xl">
              <MessageSquare size={52} className="text-teal-600" />
            </div>
            <h2 className="mt-6 text-3xl font-black text-gray-900">Connect Chat</h2>
            <p className="mt-3 max-w-md text-sm leading-7 text-gray-500">
              Open any conversation to message in real time, send files, pay a user, clear a chat, and manage message actions from one clean workspace.
            </p>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs font-semibold text-gray-500 shadow-sm">
              <Lock size={14} />
              End-to-end encrypted
            </div>
          </div>
        )}
      </section>

      <AnimatePresence>
        {isNewChatModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between bg-teal-700 px-5 py-4 text-white">
                <div>
                  <h3 className="text-xl font-black">New Chat</h3>
                  <p className="text-xs text-teal-100">Start a conversation with a connection.</p>
                </div>
                <button
                  onClick={() => setIsNewChatModalOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-white/10"
                >
                  <ArrowLeft size={22} className="rotate-180" />
                </button>
              </div>

              <div className="border-b border-gray-100 p-4">
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={newChatSearchQuery}
                    onChange={(event) => setNewChatSearchQuery(event.target.value)}
                    placeholder="Search users..."
                    className="w-full rounded-2xl border border-transparent bg-gray-100 py-3 pl-10 pr-4 text-sm transition-all focus:border-teal-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {filteredNewChatUsers.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-500">No users found.</div>
                ) : (
                  filteredNewChatUsers.map((user) => (
                    <button
                      key={user.uid}
                      onClick={() => {
                        setIsNewChatModalOpen(false);
                        openConversation(user, {
                          otherUid: user.uid,
                          lastMessage: '',
                          updatedAt: new Date().toISOString(),
                        });
                      }}
                      className="flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition-all hover:bg-gray-50"
                    >
                      <CachedImage
                        src={user.photoURL}
                        alt={user.displayName}
                        wrapperClassName="h-12 w-12 rounded-2xl border border-gray-200 bg-gray-100"
                        imgClassName="h-full w-full rounded-2xl object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-900">{user.displayName}</p>
                        <p className="truncate text-xs text-gray-500">
                          {user.publicId || user.uid} · {user.role}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chatActionsUser && (
          <BottomSheet onClose={() => setChatActionsUser(null)} zIndex="z-[71]">
            <div className="mx-auto max-w-md space-y-4">
              <div className="text-center">
                <p className="text-base font-black text-gray-900">{chatActionsUser.displayName}</p>
                <p className="text-xs text-gray-500">Choose what you want to do with this contact.</p>
              </div>
              <div className="space-y-2">
                <SheetButton
                  onClick={() => {
                    openConversation(chatActionsUser, {
                      otherUid: chatActionsUser.uid,
                      lastMessage: '',
                      updatedAt: new Date().toISOString(),
                    });
                    setChatActionsUser(null);
                  }}
                >
                  Open chat
                </SheetButton>
                <SheetButton onClick={() => goToPayUser(chatActionsUser)} tone="success" icon={<CircleDollarSign size={16} />}>
                  Pay user
                </SheetButton>
                {selectedContact?.uid === chatActionsUser.uid && (
                  <SheetButton onClick={handleClearCurrentChat} tone="danger">
                    Clear chats
                  </SheetButton>
                )}
                <SheetButton
                  onClick={() => {
                    navigate(`/profile/${chatActionsUser.uid}`);
                    setChatActionsUser(null);
                  }}
                >
                  View profile
                </SheetButton>
              </div>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {messageActionsMessage && (
          <BottomSheet onClose={() => setMessageActionsMessage(null)} zIndex="z-[73]">
            <div className="mx-auto max-w-md space-y-4">
              <div className="text-center">
                <p className="text-base font-black text-gray-900">Message options</p>
                <p className="text-xs text-gray-500">
                  {messageActionsMessage.isDeleted ? 'This message has already been deleted.' : 'Choose what you want to do with this message.'}
                </p>
              </div>
              <div className="space-y-2">
                {messageActionsMessage.senderUid === profile.uid && !messageActionsMessage.isDeleted ? (
                  <>
                    <SheetButton onClick={() => handleEditMessage(messageActionsMessage)}>Edit message</SheetButton>
                    <SheetButton onClick={() => handleDeleteMessage(messageActionsMessage)} tone="danger">
                      Delete message
                    </SheetButton>
                  </>
                ) : (
                  <div className="rounded-2xl bg-gray-100 px-4 py-3 text-sm font-medium text-gray-600">
                    Only messages you sent can be edited or deleted.
                  </div>
                )}
              </div>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>
    </div>
  );
}

function AttachmentMenuButton({
  icon,
  iconClassName,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  iconClassName: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
    >
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconClassName}`}>{icon}</span>
      {label}
    </button>
  );
}

function ReceiptIcon({ state }: { state: 'pending' | 'failed' | 'sent' | 'delivered' | 'read' }) {
  if (state === 'pending') {
    return <Loader2 size={11} className="animate-spin text-gray-400" />;
  }
  if (state === 'failed') {
    return <X size={11} className="text-red-500" />;
  }
  if (state === 'sent') {
    return <Check size={12} className="stroke-[3] text-gray-500" />;
  }
  const tickColor = state === 'read' ? 'text-blue-500' : 'text-gray-500';
  return (
    <span className={`inline-flex items-center gap-0.5 ${tickColor}`}>
      <Check size={12} className="stroke-[3]" />
      <Check size={12} className="-ml-1.5 stroke-[3]" />
    </span>
  );
}

function BottomSheet({
  children,
  onClose,
  zIndex,
}: {
  children: React.ReactNode;
  onClose: () => void;
  zIndex: string;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/40"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className={`fixed bottom-0 left-0 right-0 ${zIndex} rounded-t-[2rem] border-t border-gray-200 bg-white p-5`}
      >
        {children}
      </motion.div>
    </>
  );
}

function SheetButton({
  children,
  onClick,
  tone = 'default',
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void | Promise<void>;
  tone?: 'default' | 'danger' | 'success';
  icon?: React.ReactNode;
}) {
  const className =
    tone === 'danger'
      ? 'bg-red-50 text-red-600 hover:bg-red-100'
      : tone === 'success'
      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
      : 'bg-gray-100 text-gray-800 hover:bg-gray-200';

  return (
    <button
      onClick={() => void onClick()}
      className={`inline-flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-all ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}
