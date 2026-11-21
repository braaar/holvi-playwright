// Sends an accounting journal to Kilta, the lab's membership register, so
// nobody has to upload it by hand. Kilta reviews it first; we show the review
// and only import when asked to. Importing the same or an overlapping journal
// again is safe: Kilta stores and posts each transaction once.
//
// Run on its own to send a journal downloaded earlier:
//   pnpm kilta Accounting_journal_2025.xlsx

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { confirm, input } from "@inquirer/prompts";

type Tally = { n: number; amountCents: number };
type Issue = { code: string; n?: number; text?: string; date?: string };

type Review = {
  statement: {
    format: string;
    businessId?: string;
    from?: string;
    to?: string;
    transactions: number;
    problems: { code: string; row?: number; text?: string }[];
  };
  importable: boolean;
  plan: {
    creditFrom?: string;
    blockers: Issue[];
    warnings: Issue[];
    fresh: number;
    known: number;
    inCents: number;
    outCents: number;
    recategorised: number;
    newCategories: string[];
    missing: { bookedOn: string; amountCents: number; counterparty?: string }[];
    payments: Record<string, Tally>;
  };
  outcome?: {
    added: number;
    recategorised: number;
    payments: Record<string, Tally>;
  };
};

// Where money in goes, in the order Kilta's own pages show them.
const postings: Record<string, string> = {
  member: "to members",
  invoice: "to invoices",
  suspense: "to suspense (for the board to match)",
  "already-posted": "already posted earlier",
};

const euros = (cents: number) =>
  new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );

function describe(issue: Issue): string {
  switch (issue.code) {
    case "no-credit-from":
      return "No day to credit members from has been set yet (the lab's first import)";
    case "credit-from-too-early":
      return `The day to credit members from must be after ${issue.date}, the last balance brought over from the old register`;
    case "other-business":
      return `The journal is for another Business ID than the lab's (${issue.text})`;
    case "file-problems":
      return `The file has ${issue.n} problem(s), listed above`;
    case "missing":
      return `${issue.n} stored transaction(s) for this period are not in the journal any more`;
    case "before-credit-from":
      return `${issue.n} payment(s) are before ${issue.date}, the day members are credited from: stored, not posted`;
    default:
      return [issue.code, issue.n, issue.text, issue.date].filter(Boolean).join(" ");
  }
}

function showPayments(payments: Record<string, Tally>) {
  for (const [posting, label] of Object.entries(postings)) {
    const t = payments[posting];
    if (t?.n) console.log(`    ${t.n} ${label}: ${euros(t.amountCents)}`);
  }
}

function showReview({ statement: s, plan: p }: Review) {
  console.log(`\nKilta's review (${s.format}, ${s.from} – ${s.to}):`);
  console.log(`  ${s.transactions} transactions: ${p.fresh} new, ${p.known} already in Kilta`);
  if (p.fresh) console.log(`  New money in ${euros(p.inCents)}, out ${euros(p.outCents)}`);
  if (p.recategorised) console.log(`  ${p.recategorised} stored transaction(s) change category`);
  if (p.newCategories.length) console.log(`  New categories: ${p.newCategories.join(", ")}`);
  if (p.creditFrom) console.log(`  Members are credited from ${p.creditFrom}`);
  if (Object.values(p.payments).some((t) => t.n)) {
    console.log("  Payments:");
    showPayments(p.payments);
  }
  for (const problem of s.problems) {
    console.log(`  Problem${problem.row ? ` on row ${problem.row}` : ""}: ${problem.code} ${problem.text ?? ""}`);
  }
  for (const w of p.warnings) console.log(`  Note: ${describe(w)}`);
  for (const m of p.missing) {
    console.log(`    ${m.bookedOn} ${euros(m.amountCents)} ${m.counterparty ?? ""}`);
  }
  for (const b of p.blockers) console.log(`  Cannot import: ${describe(b)}`);
}

async function post(
  base: string,
  token: string | undefined,
  name: string,
  file: Buffer,
  options: { apply?: boolean; creditFrom?: string } = {},
): Promise<Review> {
  const url = new URL(`${base.replace(/\/+$/, "")}/api/bank/statements`);
  url.searchParams.set("name", name);
  if (options.apply) url.searchParams.set("apply", "true");
  if (options.creditFrom) url.searchParams.set("creditFrom", options.creditFrom);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: file,
  }).catch((error) => {
    // fetch only says "fetch failed"; the reason is in its cause
    throw new Error(`can't reach ${base}: ${error.cause?.message ?? error.message}`);
  });
  if (!res.ok) {
    // Kilta answers errors as problem+json: { title, detail, ... }
    const text = await res.text();
    let detail = text;
    try {
      const problem = JSON.parse(text);
      detail = problem.detail ?? problem.title ?? text;
    } catch {}
    throw new Error(`Kilta answered ${res.status}: ${detail}`);
  }
  return res.json();
}

// a real day, so 2026-02-30 doesn't pass
function isDay(s: string) {
  const d = new Date(`${s}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const hasBlocker = (review: Review, code: string) =>
  review.plan.blockers.some((b) => b.code === code);

/**
 * Reviews the journal in Kilta and, when the user agrees, imports it.
 * Does nothing unless KILTA_URL is set.
 */
export async function sendToKilta(path: string) {
  const base = process.env.KILTA_URL;
  if (!base) return;
  const token = process.env.KILTA_TOKEN;
  const name = basename(path);
  const file = await readFile(path);

  console.log(`\nSending ${name} to Kilta at ${base} for review...`);
  let review = await post(base, token, name, file);
  showReview(review);

  // The lab's first import needs the day from which bank payments credit
  // members. Ask for it and review again, since Kilta checks the day too.
  let creditFrom: string | undefined;
  while (hasBlocker(review, "no-credit-from") || (creditFrom && hasBlocker(review, "credit-from-too-early"))) {
    creditFrom = await input({
      message: "Credit members' bank payments from which day? (YYYY-MM-DD, empty to stop)",
      validate: (s) => s === "" || isDay(s) || "Enter a day as YYYY-MM-DD",
    });
    if (!creditFrom) {
      console.log("Not imported.");
      return;
    }
    review = await post(base, token, name, file, { creditFrom });
    showReview(review);
  }

  if (!review.importable) {
    console.log("\nKilta can't import this journal, so nothing was imported.");
    process.exitCode = 1;
    return;
  }
  if (!review.plan.fresh && !review.plan.recategorised && !creditFrom) {
    console.log("\nKilta already has everything in this journal.");
    return;
  }
  if (!(await confirm({ message: "Import it into Kilta?", default: false }))) {
    console.log("Not imported.");
    return;
  }

  const { outcome } = await post(base, token, name, file, { apply: true, creditFrom });
  console.log(`\nImported: ${outcome?.added ?? 0} new transaction(s), ${outcome?.recategorised ?? 0} recategorised.`);
  if (outcome) showPayments(outcome.payments);
}

// pnpm kilta <journal.xlsx>
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const path = process.argv[2];
  if (!path || !process.env.KILTA_URL) {
    console.error("usage: KILTA_URL=... [KILTA_TOKEN=...] pnpm kilta <journal.xlsx>");
    process.exit(2);
  }
  await sendToKilta(path).catch((error) => {
    console.error(`Kilta: ${error.message}`);
    process.exitCode = 1;
  });
}
