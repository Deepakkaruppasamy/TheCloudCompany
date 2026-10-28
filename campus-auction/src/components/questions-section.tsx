"use client";

import { useState } from "react";
import type { QuestionViewRow } from "@/data/questions";
import {
  askQuestionAction,
  answerQuestionAction,
  hideQuestionAction,
} from "@/actions/questions";
import { formatRelativeTime } from "@/lib/time";
import { IconShieldCheck } from "@/components/ui/icons";

interface QuestionsSectionProps {
  auctionId: string;
  sellerId: string;
  currentUserId?: string;
  isSeller: boolean;
  questions: QuestionViewRow[];
  isAuctionActive: boolean;
}

export default function QuestionsSection({
  auctionId,
  sellerId,
  currentUserId,
  isSeller,
  questions,
  isAuctionActive,
}: QuestionsSectionProps) {
  // Ask form state
  const [questionText, setQuestionText] = useState("");
  const [askError, setAskError] = useState<string | null>(null);
  const [askSuccess, setAskSuccess] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  // Answer form states
  const [activeAnswerId, setActiveAnswerId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);

  // Hide modal states
  const [activeHideId, setActiveHideId] = useState<string | null>(null);
  const [hideReason, setHideReason] = useState("");
  const [hideError, setHideError] = useState<string | null>(null);
  const [isHiding, setIsHiding] = useState(false);

  // Buyer quota check: user asked count
  const myQuestionsCount = questions.filter((q) => q.asker_id === currentUserId).length;
  const canAskMore = myQuestionsCount < 5;

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    setAskError(null);
    setAskSuccess(null);

    if (questionText.trim().length < 5) {
      setAskError("Question must be at least 5 characters.");
      return;
    }

    setIsAsking(true);
    const fd = new FormData();
    fd.append("auctionId", auctionId);
    fd.append("question", questionText.trim());

    const res = await askQuestionAction(null, fd);
    setIsAsking(false);

    if (!res.ok) {
      setAskError(res.error);
    } else {
      setQuestionText("");
      setAskSuccess("Your question was posted! The seller has been notified.");
    }
  };

  const handleAnswer = async (questionId: string) => {
    setAnswerError(null);
    if (!answerText.trim()) {
      setAnswerError("Please enter an answer.");
      return;
    }

    setIsAnswering(true);
    const fd = new FormData();
    fd.append("questionId", questionId);
    fd.append("auctionId", auctionId);
    fd.append("answer", answerText.trim());

    const res = await answerQuestionAction(null, fd);
    setIsAnswering(false);

    if (!res.ok) {
      setAnswerError(res.error);
    } else {
      setActiveAnswerId(null);
      setAnswerText("");
    }
  };

  const handleHide = async (questionId: string) => {
    setHideError(null);
    if (!hideReason.trim()) {
      setHideError("Please provide a moderation reason.");
      return;
    }

    setIsHiding(true);
    const fd = new FormData();
    fd.append("questionId", questionId);
    fd.append("auctionId", auctionId);
    fd.append("reason", hideReason.trim());

    const res = await hideQuestionAction(null, fd);
    setIsHiding(false);

    if (!res.ok) {
      setHideError(res.error);
    } else {
      setActiveHideId(null);
      setHideReason("");
    }
  };

  return (
    <section className="glass rounded-3xl p-6 sm:p-8 space-y-6 border border-white/[0.08]" id="questions">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>💬</span> Questions & Answers
          </h2>
          <p className="text-xs text-white/50 mt-1">
            Ask about item condition, wear, or specs before bidding. Seller answers are public to all buyers.
          </p>
        </div>
        <div className="text-xs text-brand-300 font-semibold px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 w-fit">
          {questions.length} {questions.length === 1 ? "Question" : "Questions"}
        </div>
      </div>

      {/* Ask Question Box (for verified buyers) */}
      {!isSeller && isAuctionActive && currentUserId && (
        <form onSubmit={handleAsk} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white/80">Ask the seller a question</span>
            <span className="text-white/40">{myQuestionsCount}/5 questions used</span>
          </div>

          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            disabled={!canAskMore || isAsking}
            placeholder={
              canAskMore
                ? "e.g. Does the calculator have battery corrosion? When was the cycle serviced?"
                : "You have reached the maximum of 5 questions for this listing."
            }
            rows={2}
            className="w-full text-sm bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-brand-500/50 resize-none disabled:opacity-50"
          />

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] text-white/40">
              Only your display name is visible. Questions must be 5-500 chars.
            </span>
            <button
              type="submit"
              disabled={!canAskMore || isAsking || questionText.trim().length < 5}
              className="btn btn-primary btn-sm px-4 py-2 text-xs font-semibold"
            >
              {isAsking ? "Posting..." : "Submit Question"}
            </button>
          </div>

          {askError && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              {askError}
            </div>
          )}
          {askSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
              {askSuccess}
            </div>
          )}
        </form>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="py-8 text-center text-white/40 text-sm">
            No questions asked yet on this listing.
          </div>
        ) : (
          questions.map((q) => {
            const isMine = q.asker_id === currentUserId;

            if (q.is_hidden && !isSeller) {
              return null; // Masked for non-sellers
            }

            return (
              <div
                key={q.id}
                className={`p-4 rounded-2xl border transition-all ${
                  q.is_hidden
                    ? "bg-red-500/[0.04] border-red-500/20 opacity-70"
                    : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]"
                }`}
              >
                {/* Header: Asker display name & timestamp */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <span className="font-semibold text-white/90">
                      {q.asker_display_name || "Campus Buyer"}
                    </span>
                    {isMine && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 font-medium">
                        You
                      </span>
                    )}
                    <span>•</span>
                    <span className="text-[11px] text-white/40">{formatRelativeTime(q.created_at)}</span>
                    {q.is_hidden && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-medium">
                        Hidden: {q.hidden_reason}
                      </span>
                    )}
                  </div>

                  {/* Seller moderation controls */}
                  {isSeller && !q.is_hidden && (
                    <button
                      onClick={() => {
                        setActiveHideId(q.id);
                        setHideReason("");
                        setHideError(null);
                      }}
                      className="text-[11px] text-red-400/80 hover:text-red-300 hover:underline"
                    >
                      Hide
                    </button>
                  )}
                </div>

                {/* Question body */}
                <p className="text-sm text-white/90 font-medium pl-1 border-l-2 border-brand-500/50 my-2">
                  {q.question}
                </p>

                {/* Answer section */}
                {q.answer ? (
                  <div className="mt-3 p-3 rounded-xl bg-brand-500/[0.06] border border-brand-500/15 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-brand-300 font-semibold">
                      <IconShieldCheck className="w-3.5 h-3.5 text-brand-400" />
                      <span>Seller Response</span>
                      {q.answered_at && (
                        <span className="text-[11px] font-normal text-white/40 ml-1">
                          {formatRelativeTime(q.answered_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/80 whitespace-pre-wrap">{q.answer}</p>
                  </div>
                ) : isSeller ? (
                  /* Seller unanswered prompt */
                  <div className="mt-3">
                    {activeAnswerId === q.id ? (
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2">
                        <textarea
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="Type your answer to this buyer (max 1000 chars)..."
                          rows={2}
                          className="w-full text-xs bg-black/40 border border-white/10 rounded-lg p-2 text-white placeholder-white/30 focus:outline-none focus:border-brand-500/50 resize-none"
                        />
                        {answerError && <p className="text-xs text-red-400">{answerError}</p>}
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveAnswerId(null);
                              setAnswerText("");
                            }}
                            className="btn btn-secondary btn-sm text-xs py-1"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isAnswering}
                            onClick={() => handleAnswer(q.id)}
                            className="btn btn-primary btn-sm text-xs py-1"
                          >
                            {isAnswering ? "Sending..." : "Publish Answer"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveAnswerId(q.id);
                          setAnswerText("");
                          setAnswerError(null);
                        }}
                        className="btn btn-secondary btn-sm text-xs py-1 text-brand-300 hover:text-white"
                      >
                        ✍️ Answer this question
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-white/40 italic mt-2">Awaiting seller response...</p>
                )}

                {/* Hide Modal / Dialog */}
                {activeHideId === q.id && (
                  <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 space-y-2">
                    <p className="text-xs font-semibold text-red-300">Hide Question from Listing</p>
                    <input
                      type="text"
                      value={hideReason}
                      onChange={(e) => setHideReason(e.target.value)}
                      placeholder="Reason (e.g. spam, inappropriate, irrelevant)"
                      className="w-full text-xs bg-black/50 border border-red-500/30 rounded-lg p-2 text-white placeholder-white/30"
                    />
                    {hideError && <p className="text-xs text-red-400">{hideError}</p>}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveHideId(null)}
                        className="btn btn-secondary btn-sm text-xs py-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isHiding}
                        onClick={() => handleHide(q.id)}
                        className="btn btn-danger btn-sm text-xs py-1"
                      >
                        {isHiding ? "Hiding..." : "Confirm Hide"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

