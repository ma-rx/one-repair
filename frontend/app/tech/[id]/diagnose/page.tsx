"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, RepairImage, Ticket } from "@/lib/api";
import { ArrowLeft, Bot, Send, Loader2, X } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Cache of term → image (null means searched, no result)
type ImageCache = Record<string, RepairImage | null>;

function parseSegments(text: string): Array<{ type: "text" | "term"; value: string }> {
  const segments: Array<{ type: "text" | "term"; value: string }> = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: "text", value: text.slice(last, m.index) });
    segments.push({ type: "term", value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ type: "text", value: text.slice(last) });
  return segments;
}

function MessageBubble({
  message,
  imageCache,
  onTermClick,
}: {
  message: ChatMessage;
  imageCache: ImageCache;
  onTermClick: (term: string) => void;
}) {
  if (message.role === "user") {
    return <p className="whitespace-pre-wrap">{message.content}</p>;
  }

  const segments = parseSegments(message.content);
  return (
    <p className="whitespace-pre-wrap">
      {segments.map((seg, i) => {
        if (seg.type === "text") return <span key={i}>{seg.value}</span>;
        const hasImage = imageCache[seg.value] !== undefined && imageCache[seg.value] !== null;
        if (imageCache[seg.value] === undefined) {
          // Still loading or not yet searched — render plain
          return <span key={i}>{seg.value}</span>;
        }
        if (!hasImage) {
          // Searched, no image found — render plain
          return <span key={i}>{seg.value}</span>;
        }
        return (
          <button
            key={i}
            onClick={() => onTermClick(seg.value)}
            className="text-blue-600 underline underline-offset-2 font-medium hover:text-blue-800 transition-colors"
          >
            {seg.value}
          </button>
        );
      })}
    </p>
  );
}

export default function DiagnoseChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ticket, setTicket]   = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]     = useState("");
  const [sending, setSending] = useState(false);
  const [loadingTicket, setLoadingTicket] = useState(true);
  const [imageCache, setImageCache] = useState<ImageCache>({});
  const [lightboxImage, setLightboxImage] = useState<RepairImage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lookupTerms = useCallback(async (text: string) => {
    const terms = Array.from(new Set(
      [...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1])
    ));
    if (terms.length === 0) return;
    const uncached = terms.filter((t) => !(t in imageCache));
    if (uncached.length === 0) return;

    // Mark as "searching" (undefined → being looked up)
    const results: ImageCache = {};
    await Promise.all(
      uncached.map(async (term) => {
        try {
          const found = await api.searchRepairImages(term);
          results[term] = found.length > 0 ? found[0] : null;
        } catch {
          results[term] = null;
        }
      })
    );
    setImageCache((prev) => ({ ...prev, ...results }));
  }, [imageCache]);

  useEffect(() => {
    api.getTicket(id)
      .then((t) => {
        setTicket(t);
        setMessages([{
          role: "assistant",
          content: `Hi! I'm your repair assistant. Tell me what's going on with the ${t.asset_name}.`,
        }]);
      })
      .finally(() => setLoadingTicket(false));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    if (!input.trim() || sending || !ticket) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput("");
    setSending(true);

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const { reply } = await api.diagnosticChat(updated, {
        asset_name:     ticket.asset_name,
        asset_category: ticket.asset_category,
        make:           ticket.asset_make,
        model_number:   ticket.asset_model_number,
        store_name:     ticket.store_name,
      });
      const assistantMsg: ChatMessage = { role: "assistant", content: reply };
      setMessages([...updated, assistantMsg]);
      lookupTerms(reply);
    } catch {
      setMessages([...updated, {
        role: "assistant",
        content: "Sorry, I'm having trouble connecting right now. Please try again.",
      }]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-grow textarea
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  if (loadingTicket) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.back()}
          className="p-1.5 -ml-1 text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm">AI Repair Assistant</p>
          {ticket && (
            <p className="text-xs text-slate-400 truncate">
              {ticket.asset_name} · {ticket.store_name}
            </p>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mb-0.5">
                <Bot className="w-3.5 h-3.5 text-blue-600" />
              </div>
            )}
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-white text-slate-800 rounded-bl-sm border border-slate-200 shadow-sm"
              }`}
            >
              <MessageBubble
                message={m}
                imageCache={imageCache}
                onTermClick={(term) => setLightboxImage(imageCache[term] ?? null)}
              />
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mb-0.5">
              <Bot className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "160ms" }} />
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "320ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="bg-white border-t border-slate-200 px-4 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            className="flex-1 border border-slate-300 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
            placeholder="Describe what you're seeing…"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-full flex items-center justify-center transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 text-center mt-2">Enter to send · Shift+Enter for new line</p>
      </div>

      {/* Image lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightboxImage.url} alt={lightboxImage.title} className="w-full max-h-72 object-contain bg-slate-100" />
            <div className="p-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{lightboxImage.title}</p>
                {(lightboxImage.make || lightboxImage.asset_category) && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {[lightboxImage.make, lightboxImage.asset_category].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <button onClick={() => setLightboxImage(null)} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
