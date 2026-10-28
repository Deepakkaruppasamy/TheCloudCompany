"use server";
/**
 * src/actions/questions.ts
 *
 * Server Actions for auction questions and answers.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  AskQuestionSchema,
  AnswerQuestionSchema,
  HideQuestionSchema,
} from "@/lib/validation/questions";
import {
  askQuestionRpc,
  answerQuestionRpc,
  hideQuestionRpc,
} from "@/data/questions";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function askQuestionAction(
  _prevState: any,
  formData: FormData
): Promise<ActionResult<string>> {
  try {
    await requireUser();

    const raw = {
      auctionId: formData.get("auctionId"),
      question: formData.get("question"),
    };

    const parsed = AskQuestionSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid question input." };
    }

    const questionId = await askQuestionRpc(parsed.data.auctionId, parsed.data.question);
    revalidatePath(`/auctions/${parsed.data.auctionId}`);
    return { ok: true, data: questionId };
  } catch (err: any) {
    const msg = err?.message || "Failed to submit question.";
    if (msg.includes("not_eligible") || msg.includes("not_verified")) {
      return { ok: false, error: "Only verified student accounts can ask questions." };
    }
    if (msg.includes("seller_cannot_ask")) {
      return { ok: false, error: "Sellers cannot ask questions on their own listings." };
    }
    if (msg.includes("max_questions_exceeded")) {
      return { ok: false, error: "You have reached the maximum of 5 questions for this listing." };
    }
    if (msg.includes("rate_limit_exceeded")) {
      return { ok: false, error: "Please wait at least 1 minute before asking another question." };
    }
    if (msg.includes("auction_not_active")) {
      return { ok: false, error: "Questions can only be asked on active auctions." };
    }
    return { ok: false, error: msg };
  }
}

export async function answerQuestionAction(
  _prevState: any,
  formData: FormData
): Promise<ActionResult<void>> {
  try {
    await requireUser();

    const raw = {
      questionId: formData.get("questionId"),
      answer: formData.get("answer"),
    };
    const auctionId = formData.get("auctionId") as string | null;

    const parsed = AnswerQuestionSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid answer input." };
    }

    await answerQuestionRpc(parsed.data.questionId, parsed.data.answer);
    if (auctionId) {
      revalidatePath(`/auctions/${auctionId}`);
      revalidatePath(`/my-listings/${auctionId}`);
    }
    return { ok: true, data: undefined };
  } catch (err: any) {
    const msg = err?.message || "Failed to answer question.";
    if (msg.includes("only_seller_can_answer")) {
      return { ok: false, error: "Only the seller can answer questions for this listing." };
    }
    if (msg.includes("already_answered")) {
      return { ok: false, error: "This question has already been answered." };
    }
    return { ok: false, error: msg };
  }
}

export async function hideQuestionAction(
  _prevState: any,
  formData: FormData
): Promise<ActionResult<void>> {
  try {
    await requireUser();

    const raw = {
      questionId: formData.get("questionId"),
      reason: formData.get("reason"),
    };
    const auctionId = formData.get("auctionId") as string | null;

    const parsed = HideQuestionSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid hide input." };
    }

    await hideQuestionRpc(parsed.data.questionId, parsed.data.reason);
    if (auctionId) {
      revalidatePath(`/auctions/${auctionId}`);
      revalidatePath(`/my-listings/${auctionId}`);
    }
    return { ok: true, data: undefined };
  } catch (err: any) {
    const msg = err?.message || "Failed to hide question.";
    if (msg.includes("not_authorized_to_hide")) {
      return { ok: false, error: "Not authorized to moderate this question." };
    }
    return { ok: false, error: msg };
  }
}

