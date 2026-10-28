"use client";

import { useState } from "react";
import Link from "next/link";
import { chatWithAssistant, type AssistantResponse } from "@/actions/assistant";
import { setAutoBidAction } from "@/actions/bids";
import { formatPaise } from "@/domain/money";
import { formatRelativeTime } from "@/lib/time";
import { IconShieldCheck, IconClock, IconTag } from "./ui/icons";

interface Message {
  sender: "user" | "assistant";
  text: string;
  response?: AssistantResponse;
}

export default function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "assistant",
      text: "👋 Hi! I'm your Campus Marketplace Assistant. Tell me what you're looking for (e.g. \"find me a cycle under ₹2,000\" or \"scientific calculator\") and I'll find the best listings or prepare a confirmed bid proposal for you.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposalStatus, setProposalStatus] = useState<Record<string, string>>({});

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: Message = { sender: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      const res = await chatWithAssistant(text);
      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: res.reply,
          response: res,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: "Sorry, I had trouble searching the marketplace right now. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmBid = async (auctionId: string, proposedRupees: number) => {
    setProposalStatus((prev) => ({ ...prev, [auctionId]: "submitting" }));

    const fd = new FormData();
    fd.append("auctionId", auctionId);
    fd.append("maxRupees", String(proposedRupees));

    const res = await setAutoBidAction(null, fd);

    if (res.ok) {
      setProposalStatus((prev) => ({
        ...prev,
        [auctionId]: `✓ Confirmed! Automatic proxy bid activated up to ₹${proposedRupees}.`,
      }));
    } else {
      setProposalStatus((prev) => ({
        ...prev,
        [auctionId]: `Error: ${res.error}`,
      }));
    }
  };

  const quickPrompts = [
    "Find me a cycle under ₹2,000",
    "Scientific calculator for exams",
    "Engineering textbooks under ₹500",
    "Laptops and electronics",
  ];

  return (
    <div className="glass rounded-3xl border border-white/[0.08] flex flex-col h-[700px] overflow-hidden bg-[#10111a]">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-lg text-white shadow-md shadow-brand-900/40">
            🤖
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Campus Assistant</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Safe & Confirmed
              </span>
            </h2>
            <p className="text-[11px] text-white/50">
              Plays by the rules: never acts without your confirmation, never reveals account details.
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${
              m.sender === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                m.sender === "user"
                  ? "bg-brand-600 text-white rounded-br-none shadow-md shadow-brand-900/40"
                  : "bg-white/[0.04] border border-white/[0.08] text-white/90 rounded-bl-none"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>

              {/* Matched Listing Cards */}
              {m.response?.matchedAuctions && m.response.matchedAuctions.length > 0 && (
                <div className="mt-4 space-y-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                    Marketplace Matches:
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {m.response.matchedAuctions.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-3 hover:border-brand-500/40 transition-all"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">
                            {item.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-white/50">
                            <span>Category: {item.category}</span>
                            <span>•</span>
                            <span>Condition: {item.condition}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-brand-300 font-mono">
                            {formatPaise(item.currentPricePaise)}
                          </p>
                          <Link
                            href={`/auctions/${item.id}`}
                            className="text-[10px] text-white/60 hover:text-brand-300 underline font-medium block mt-0.5"
                          >
                            View Auction →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Assisted Bidding Human-in-the-Loop Proposal Card */}
              {m.response?.proposal && (
                <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <IconShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Assisted Bid Proposal (Requires Your Confirmation)</span>
                  </div>

                  <div className="space-y-1 text-xs text-white/80 bg-black/30 p-2.5 rounded-xl border border-white/5">
                    <div className="flex justify-between">
                      <span className="text-white/50">Item:</span>
                      <span className="font-semibold text-white">{m.response.proposal.auctionTitle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Current Leading Bid:</span>
                      <span className="font-mono">{formatPaise(m.response.proposal.currentPricePaise)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                      <span className="text-amber-300 font-medium">Proposed Max Ceiling:</span>
                      <span className="text-amber-300 font-bold font-mono text-sm">
                        ₹{m.response.proposal.proposedRupees}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-white/50">
                    🛡️ The assistant will never bid without your confirmation or exceed this limit.
                  </p>

                  {proposalStatus[m.response.proposal.auctionId] ? (
                    <div className="p-2 rounded-xl bg-black/40 text-xs font-medium text-emerald-300">
                      {proposalStatus[m.response.proposal.auctionId]}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        handleConfirmBid(
                          m.response!.proposal!.auctionId,
                          m.response!.proposal!.proposedRupees
                        )
                      }
                      className="btn btn-primary btn-sm w-full text-xs font-bold shadow-md shadow-brand-900/40"
                    >
                      ✓ Confirm & Place Auto-Bid of ₹{m.response.proposal.proposedRupees}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-white/40 p-2">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            <span>Assistant is searching active campus listings…</span>
          </div>
        )}
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-4 py-2 border-t border-white/[0.06] bg-white/[0.01] flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[10px] uppercase font-bold text-white/30 shrink-0">Try:</span>
        {quickPrompts.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => handleSend(q)}
            className="px-2.5 py-1 rounded-lg text-xs bg-white/[0.04] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.08] whitespace-nowrap transition-all"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 sm:p-4 border-t border-white/[0.08] bg-black/40 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask e.g. 'find me a cycle under ₹2,000' or 'bid ₹1,800 on casio'..."
          disabled={loading}
          className="flex-1 text-xs sm:text-sm bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500/50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn btn-primary btn-md px-5 text-xs font-bold rounded-2xl shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  );
}

