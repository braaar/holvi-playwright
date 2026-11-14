import playwright from "playwright";
import { input, password, select } from "@inquirer/prompts";

// take in username and password from command line before starting the browser,
// so the login page doesn't sit idle while we wait for input
const email = await input({ message: "Enter your Holvi account email:" });

const pass = await password({
  message: "Enter your Holvi Account password:",
  validate: (input) => input.length > 0,
});

const choice = await select({
  message: "Select the report you want to download",
  choices: [
    { name: "General ledger", value: "General ledger" },
    { name: "Account statement", value: "Account statement" },
  ],
});

// default to last year, since that's the one you close the books for
const year = await input({
  message: "Which year do you want the report for?",
  default: String(new Date().getFullYear() - 1),
  validate: (input) => /^\d{4}$/.test(input) || "Enter a four-digit year",
});

// set HEADED=1 to watch the browser while debugging
const browser = await playwright.chromium.launch({
  headless: !process.env.HEADED,
});
const page = await browser.newPage();

try {
  await page.goto("https://login.app.holvi.com/");

  // the cookie banner doesn't always show up (e.g. when cookies are remembered)
  await page
    .getByRole("button", { name: "Reject All" })
    .click({ timeout: 5_000 })
    .catch(() => {});

  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(pass);
  console.log("Logging in...");
  await page.locator('[data-test="submit-button"]').click();

  console.log("Please confirm your login on your mobile device");

  // confirming on the phone can take a while, so don't use the default 30s timeout.
  // the link's accessible name includes an icon ligature ("trending_up"), so match on the text only
  const reportsLink = page.getByRole("link", { name: /Reports/ });
  await reportsLink.waitFor({ timeout: 5 * 60_000 });
  console.log("Logged in");
  await reportsLink.click();

  const reportLocators: Record<string, playwright.Locator> = {
    "Account statement": page.locator("#accountStatement"),
    // only #accountStatement has been seen in a recording, so fall back to the text
    "General ledger": page
      .locator("#generalLedger")
      .or(page.getByText(/^General ledger/))
      .first(),
  };
  await reportLocators[choice].click();

  // the fields accept typed dates, so we can skip the date picker
  await page.getByRole("textbox", { name: "From" }).fill(`01/01/${year}`);
  await page.getByRole("textbox", { name: "To" }).fill(`31/12/${year}`);
  // close the date picker so it doesn't cover the export links
  await page.keyboard.press("Escape");

  // exporting navigates to a downloads page, which starts the download once
  // Holvi has generated the file, so start listening before clicking
  const downloadPromise = page.waitForEvent("download", { timeout: 5 * 60_000 });
  await page
    .locator('[data-test="section-block"]')
    .getByRole("link", { name: `Export "${choice}" as XLS` })
    .click();
  console.log("Waiting for Holvi to generate the report...");
  const download = await downloadPromise;

  const filename = `${choice.replace(/ /g, "_")}_${year}.xlsx`;
  await download.saveAs(filename);
  console.log(`Download completed. File saved as ${filename}`);
} catch (error) {
  // headless failures are hard to diagnose without seeing the page
  await page.screenshot({ path: "error.png", fullPage: true }).catch(() => {});
  console.error("Something went wrong, see error.png for the page state");
  throw error;
} finally {
  await browser.close();
}
