/**
 * src/app/(marketplace)/assistant/page.tsx
 *
 * AI Marketplace Assistant page — natural language search & confirmed assisted bidding.
 * Server Component with interactive client chat.
 */
import type { Metadata } from "next";
import AssistantChat from "@/components/assistant-chat";

export const metadata: Metadata = {
  title: "AI Assistant | Campus Auction",
  description:
    "Ask in plain English to find items or prepare assisted bids. Never acts without your confirmation.",
};

export default function AssistantPage() {
  return (
    <div className="page-container max-w-4xl space-y-6">
      <div>
        <h1 className="section-title">Campus AI Assistant</h1>
        <p className="section-subtitle">
          Say what you need (e.g. &ldquo;find me a cycle under ₹2,000&rdquo;) and get straight answers without manual searching.
        </p>
      </div>

      <AssistantChat />
    </div>
  );
}

