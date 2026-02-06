import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Send,
  Paperclip,
  Search,
  ChevronRight,
  MessageSquare,
  FileText,
  Building2,
  User,
  Clock,
  Check,
  CheckCheck,
  ExternalLink,
  Tag,
  Calendar,
  DollarSign,
  Loader2,
  X,
} from 'lucide-react';
import DashboardNav from '@/components/DashboardNav';
import { dashboardTheme, getStatusBadgeClass } from '@/styles/dashboardTheme';
import api from '@/lib/api';
import { Message, RFQ, User as UserType } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  rfq_id: string;
  rfq_title: string;
  partner: {
    id: string;
    name: string;
    company: string;
    email?: string;
    avatar_url?: string;
    is_online?: boolean;
  };
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface ConversationDetail {
  conversation: Conversation;
  messages: Message[];
  rfq?: RFQ;
}

interface QuoteSummary {
  price: string;
  lead_time_days: number;
  status: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function dateSeparatorLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = today.getTime() - messageDay.getTime();
  if (diff === 0) return 'Today';
  if (diff === 86_400_000) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function shouldShowDateSeparator(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].created_at);
  const curr = new Date(messages[index].created_at);
  return (
    prev.getFullYear() !== curr.getFullYear() ||
    prev.getMonth() !== curr.getMonth() ||
    prev.getDate() !== curr.getDate()
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ── Current user helper ──────────────────────────────────────────────────────

function getCurrentUserId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || payload.user_id || '';
  } catch {
    return '';
  }
}

// ── Conversation List ────────────────────────────────────────────────────────

function ConversationList({
  conversations,
  activeId,
  onSelect,
  loading,
  searchQuery,
  onSearchChange,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (c: Conversation) => void;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.partner.name.toLowerCase().includes(q) ||
        c.partner.company.toLowerCase().includes(q) ||
        c.rfq_title.toLowerCase().includes(q) ||
        c.last_message.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  // Group by RFQ title
  const grouped = useMemo(() => {
    const map = new Map<string, Conversation[]>();
    filtered.forEach((c) => {
      const key = c.rfq_title || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return map;
  }, [filtered]);

  return (
    <div className="w-full md:w-80 border-r border-secondary-200 flex flex-col bg-white/60 backdrop-blur-sm">
      {/* Search */}
      <div className="p-3 border-b border-secondary-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`${dashboardTheme.forms.input} pl-9 !py-2.5 !text-sm`}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-3">
                <div className={`w-10 h-10 rounded-full flex-shrink-0 ${dashboardTheme.loading.skeleton}`} />
                <div className="flex-1 space-y-2">
                  <div className={`w-3/4 h-4 ${dashboardTheme.loading.skeleton}`} />
                  <div className={`w-full h-3 ${dashboardTheme.loading.skeleton}`} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center">
            <MessageSquare className="w-8 h-8 text-secondary-300 mx-auto mb-2" />
            <p className={dashboardTheme.typography.bodySmall}>
              {searchQuery ? 'No conversations match your search.' : 'No conversations yet.'}
            </p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([rfqTitle, convos]) => (
            <div key={rfqTitle}>
              {/* Section header */}
              <div className="px-4 py-2 bg-secondary-50/80 border-b border-secondary-100">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-secondary-400" />
                  <span className="text-xs font-semibold text-secondary-500 uppercase tracking-wider truncate">
                    {rfqTitle}
                  </span>
                </div>
              </div>

              {convos.map((convo) => {
                const isActive = activeId === convo.id;
                return (
                  <button
                    key={convo.id}
                    onClick={() => onSelect(convo)}
                    className={`w-full text-left px-4 py-3 flex gap-3 transition-all border-l-2 ${
                      isActive
                        ? 'bg-primary-50 border-primary-500'
                        : 'border-transparent hover:bg-secondary-50'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                          isActive
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-secondary-100 text-secondary-600'
                        }`}
                      >
                        {getInitials(convo.partner.name)}
                      </div>
                      {convo.partner.is_online && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-secondary-900 truncate">
                          {convo.partner.name}
                        </span>
                        <span className={dashboardTheme.typography.caption}>
                          {formatTimestamp(convo.last_message_at)}
                        </span>
                      </div>
                      <p className="text-xs text-secondary-400 truncate">{convo.partner.company}</p>
                      <p className="text-sm text-secondary-500 truncate mt-0.5">
                        {convo.last_message}
                      </p>
                    </div>

                    {/* Unread badge */}
                    {convo.unread_count > 0 && (
                      <div className="flex-shrink-0 mt-1">
                        <span className="w-5 h-5 bg-primary-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {convo.unread_count > 9 ? '9+' : convo.unread_count}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Chat Area ────────────────────────────────────────────────────────────────

function ChatArea({
  detail,
  loading,
  onSend,
  currentUserId,
}: {
  detail: ConversationDetail | null;
  loading: boolean;
  onSend: (content: string, attachmentFile?: File) => Promise<void>;
  currentUserId: string;
}) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachProgress, setAttachProgress] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [detail?.messages, scrollToBottom]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed && !attachFile) return;
    setSending(true);
    if (attachFile) setAttachProgress(0);
    try {
      // Simulate attachment upload progress
      if (attachFile) {
        for (let i = 20; i <= 80; i += 20) {
          await new Promise((r) => setTimeout(r, 150));
          setAttachProgress(i);
        }
      }
      await onSend(trimmed, attachFile || undefined);
      setInput('');
      setAttachFile(null);
      setAttachProgress(null);
    } catch {
      // error handled by api interceptor
    } finally {
      setSending(false);
      setAttachProgress(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Empty state
  if (!detail && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-secondary-50/30">
        <div className="text-center px-6">
          <div className="w-16 h-16 bg-secondary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-secondary-400" />
          </div>
          <h3 className={dashboardTheme.typography.heading4}>No conversation selected</h3>
          <p className={`${dashboardTheme.typography.bodySmall} mt-1 max-w-xs mx-auto`}>
            Choose a conversation from the left panel to start messaging.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && !detail) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-secondary-200 flex gap-3">
          <div className={`w-10 h-10 rounded-full ${dashboardTheme.loading.skeleton}`} />
          <div className="space-y-2">
            <div className={`w-32 h-4 ${dashboardTheme.loading.skeleton}`} />
            <div className={`w-24 h-3 ${dashboardTheme.loading.skeleton}`} />
          </div>
        </div>
        <div className="flex-1 p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`${dashboardTheme.loading.skeleton} rounded-2xl`}
                style={{ width: `${40 + Math.random() * 30}%`, height: 48 }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const convo = detail!.conversation;
  const messages = detail!.messages;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 border-b border-secondary-200 bg-white/80 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold">
              {getInitials(convo.partner.name)}
            </div>
            {convo.partner.is_online && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-secondary-900 truncate">
                {convo.partner.name}
              </h4>
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  convo.partner.is_online ? 'bg-green-500' : 'bg-secondary-300'
                }`}
              />
              <span className={dashboardTheme.typography.caption}>
                {convo.partner.is_online ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-xs text-secondary-400 truncate">
              {convo.partner.company} · {convo.rfq_title}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-1 bg-secondary-50/30">
        {messages.map((msg, idx) => {
          const isOwn = msg.sender_id === currentUserId;
          const showDate = shouldShowDateSeparator(messages, idx);

          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="flex items-center justify-center py-3">
                  <span className="px-3 py-1 bg-secondary-100 text-secondary-500 text-xs font-medium rounded-full">
                    {dateSeparatorLabel(msg.created_at)}
                  </span>
                </div>
              )}

              <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
                <div className={`max-w-[75%] sm:max-w-[65%]`}>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isOwn
                        ? 'bg-primary-600 text-white rounded-br-md'
                        : 'bg-white border border-secondary-200 text-secondary-800 rounded-bl-md'
                    }`}
                  >
                    {msg.message_type === 'attachment' && msg.attachments && (
                      <div className="flex items-center gap-2 mb-1.5">
                        <Paperclip className={`w-3.5 h-3.5 ${isOwn ? 'text-primary-200' : 'text-secondary-400'}`} />
                        <span className={`text-xs underline ${isOwn ? 'text-primary-100' : 'text-primary-600'}`}>
                          Attachment
                        </span>
                      </div>
                    )}
                    {msg.content}
                  </div>
                  <div
                    className={`flex items-center gap-1.5 mt-1 ${
                      isOwn ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span className="text-[10px] text-secondary-400">
                      {formatMessageTime(msg.created_at)}
                    </span>
                    {isOwn && (
                      msg.is_read ? (
                        <CheckCheck className="w-3 h-3 text-primary-400" />
                      ) : (
                        <Check className="w-3 h-3 text-secondary-300" />
                      )
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment preview */}
      {attachFile && (
        <div className="px-4 sm:px-6 py-2 border-t border-secondary-100 bg-white/80 flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-secondary-400" />
          <span className="text-sm text-secondary-700 truncate flex-1">{attachFile.name}</span>
          {attachProgress !== null && (
            <div className="w-24 h-1.5 bg-secondary-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${attachProgress}%` }}
              />
            </div>
          )}
          <button
            onClick={() => setAttachFile(null)}
            className="text-secondary-400 hover:text-secondary-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 sm:px-6 py-3 border-t border-secondary-200 bg-white/80 backdrop-blur-sm">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setAttachFile(file);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded-xl transition-colors flex-shrink-0"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className={`${dashboardTheme.forms.input} !py-2.5 !pr-12 resize-none min-h-[42px] max-h-32`}
              style={{ height: 'auto' }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
              }}
            />
            <span className="absolute right-3 bottom-1 text-[10px] text-secondary-300 pointer-events-none hidden sm:block">
              Enter ↵
            </span>
          </div>
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !attachFile) || sending}
            className={`p-2.5 rounded-xl flex-shrink-0 transition-all ${
              input.trim() || attachFile
                ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-600/20'
                : 'bg-secondary-100 text-secondary-400 cursor-not-allowed'
            }`}
            title="Send message"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Context Panel ────────────────────────────────────────────────────────────

function ContextPanel({
  detail,
  loading,
}: {
  detail: ConversationDetail | null;
  loading: boolean;
}) {
  if (loading || !detail) {
    return (
      <div className="hidden xl:block w-72 border-l border-secondary-200 bg-white/60 backdrop-blur-sm p-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`h-36 ${dashboardTheme.loading.skeleton}`} />
        ))}
      </div>
    );
  }

  const convo = detail.conversation;
  const rfq = detail.rfq;

  return (
    <div className="hidden xl:flex w-72 border-l border-secondary-200 bg-white/60 backdrop-blur-sm flex-col overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* RFP Card */}
        {rfq && (
          <div className={`${dashboardTheme.cards.secondary} p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-primary-500" />
              <h4 className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">
                Related RFP
              </h4>
            </div>
            <h5 className="text-sm font-semibold text-secondary-900 mb-2 line-clamp-2">
              {rfq.title}
            </h5>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={dashboardTheme.typography.caption}>Status</span>
                <span className={getStatusBadgeClass(rfq.status)}>{rfq.status}</span>
              </div>
              {rfq.expires_at && (
                <div className="flex items-center justify-between">
                  <span className={dashboardTheme.typography.caption}>Deadline</span>
                  <span className="text-xs text-secondary-700 font-medium">
                    {new Date(rfq.expires_at).toLocaleDateString()}
                  </span>
                </div>
              )}
              {rfq.material_category && (
                <div className="flex items-center justify-between">
                  <span className={dashboardTheme.typography.caption}>Category</span>
                  <span className={dashboardTheme.badges.neutral}>{rfq.material_category}</span>
                </div>
              )}
            </div>
            <Link
              href={`/rfps/${rfq.id}`}
              className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 py-2 rounded-lg hover:bg-primary-50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> View RFP
            </Link>
          </div>
        )}

        {/* Partner Info */}
        <div className={`${dashboardTheme.cards.secondary} p-4`}>
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-primary-500" />
            <h4 className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">
              Contact
            </h4>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {getInitials(convo.partner.name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-secondary-900 truncate">
                {convo.partner.name}
              </p>
              <p className="text-xs text-secondary-400 truncate">{convo.partner.company}</p>
            </div>
          </div>
          {convo.partner.email && (
            <div className="flex items-center gap-2 text-xs text-secondary-500">
              <span className="truncate">{convo.partner.email}</span>
            </div>
          )}
          <Link
            href={`/dashboard/suppliers`}
            className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 py-2 rounded-lg hover:bg-primary-50 transition-colors"
          >
            <Building2 className="w-3 h-3" /> View Profile
          </Link>
        </div>

        {/* Quote Summary (mock — filled when data available) */}
        <div className={`${dashboardTheme.cards.secondary} p-4`}>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-primary-500" />
            <h4 className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">
              Quote Summary
            </h4>
          </div>
          {rfq ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={dashboardTheme.typography.caption}>Price</span>
                <span className="text-sm font-semibold text-secondary-900">
                  {rfq.target_price ? `$${rfq.target_price}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={dashboardTheme.typography.caption}>Responses</span>
                <span className="text-sm font-medium text-secondary-700">{rfq.response_count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={dashboardTheme.typography.caption}>Views</span>
                <span className="text-sm font-medium text-secondary-700">{rfq.view_count}</span>
              </div>
            </div>
          ) : (
            <p className={dashboardTheme.typography.caption}>No quote data available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Messages Page ───────────────────────────────────────────────────────

const MessagesPage = () => {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showListMobile, setShowListMobile] = useState(true);

  const currentUserId = useMemo(() => getCurrentUserId(), []);

  // ── Fetch conversations list ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const fetchConversations = async () => {
      setLoadingList(true);
      try {
        const res = await api.get('/api/v1/messages/conversations');
        const data = res.data;
        const list: Conversation[] = Array.isArray(data)
          ? data
          : data?.data ?? data?.conversations ?? [];
        if (!cancelled) setConversations(list);
      } catch {
        // If the endpoint doesn't exist yet, populate with empty
        if (!cancelled) setConversations([]);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    };
    fetchConversations();
    return () => { cancelled = true; };
  }, []);

  // ── Fetch conversation detail ──────────────────────────────────────────────
  const loadDetail = useCallback(async (convo: Conversation) => {
    setLoadingDetail(true);
    try {
      const [msgRes, rfqRes] = await Promise.allSettled([
        api.get(`/api/v1/messages/${convo.id}`),
        convo.rfq_id ? api.get(`/api/v1/rfqs/${convo.rfq_id}`) : Promise.reject('no rfq'),
      ]);

      let messages: Message[] = [];
      if (msgRes.status === 'fulfilled') {
        const md = msgRes.value.data;
        messages = Array.isArray(md) ? md : md?.data ?? md?.messages ?? [];
      }

      let rfq: RFQ | undefined;
      if (rfqRes.status === 'fulfilled') {
        const rd = rfqRes.value.data;
        rfq = rd?.data ?? rd;
      }

      setDetail({ conversation: convo, messages, rfq });
    } catch {
      setDetail({ conversation: convo, messages: [], rfq: undefined });
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleSelectConvo = useCallback(
    (convo: Conversation) => {
      setActiveConvo(convo);
      setShowListMobile(false);
      loadDetail(convo);
    },
    [loadDetail]
  );

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (content: string, attachmentFile?: File) => {
      if (!activeConvo) return;
      try {
        const payload: Record<string, unknown> = {
          rfq_id: activeConvo.rfq_id,
          recipient_id: activeConvo.partner.id,
          content,
          message_type: attachmentFile ? 'attachment' : 'text',
        };

        const res = await api.post('/api/v1/messages', payload);
        const newMsg: Message = res.data?.data ?? res.data;

        // Optimistic update
        setDetail((prev) => {
          if (!prev) return prev;
          return { ...prev, messages: [...prev.messages, newMsg] };
        });

        // Update conversation list last message
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConvo.id
              ? { ...c, last_message: content, last_message_at: new Date().toISOString() }
              : c
          )
        );
      } catch {
        // re-throw so the ChatArea can handle it
        throw new Error('Failed to send message');
      }
    },
    [activeConvo]
  );

  return (
    <DashboardNav breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Messages' }]}>
      <div
        className={`${dashboardTheme.cards.primary} overflow-hidden flex`}
        style={{ height: 'calc(100vh - 140px)', minHeight: 480 }}
      >
        {/* Mobile back button */}
        {!showListMobile && activeConvo && (
          <button
            onClick={() => setShowListMobile(true)}
            className="md:hidden absolute top-20 left-4 z-20 p-2 bg-white/90 rounded-xl shadow-sm border border-secondary-200 text-secondary-600"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
        )}

        {/* Conversation list */}
        <div className={`${showListMobile ? 'flex' : 'hidden'} md:flex flex-col`}>
          <ConversationList
            conversations={conversations}
            activeId={activeConvo?.id ?? null}
            onSelect={handleSelectConvo}
            loading={loadingList}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Chat area */}
        <div className={`${!showListMobile || !activeConvo ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`}>
          <ChatArea
            detail={detail}
            loading={loadingDetail}
            onSend={handleSend}
            currentUserId={currentUserId}
          />
        </div>

        {/* Context panel */}
        <ContextPanel detail={detail} loading={loadingDetail} />
      </div>
    </DashboardNav>
  );
};

export default MessagesPage;
