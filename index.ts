import playwright from "playwright";
import { input, password, select } from "@inquirer/prompts";

const browser = await playwright.chromium.launch({ headless: true });

const page = await browser.newPage();

// take in username and password from command line
const email = await input({ message: "Enter your Holvi account email:" });

// take in username from command line
const pass = await password({
  message: "Enter your Holvi Account password:",
  validate: (input) => input.length > 0,
});

await page.goto("https://login.app.holvi.com/");
await page.getByRole("button", { name: "Reject All" }).click();

await page.getByRole("textbox", { name: "Email" }).fill(email);
await page.getByRole("textbox", { name: "Password" }).fill(pass);
console.log("Logging in...");
await page.getByRole("button", { name: "Log in" }).click();

console.log("Please confirm your login on your mobile device");

await page.getByRole("link", { name: " Reports" }).click();

const choice = await select({
  message: "Select the report you want to download",
  choices: [
    { name: "General ledger", value: "General ledger" },
    { name: "Account statement", value: "Account statement" },
  ],
});

if (choice === "General ledger") {
  await page
    .getByRole("link")
    .filter({ hasText: "General ledger A complete" })
    .click();
} else if (choice === "Account statement") {
  await page
    .getByRole("link")
    .filter({ hasText: "Account statement A periodic" })
    .click();
} else {
  console.error("Invalid choice");
  await browser.close();
}

await page.getByRole("button", { name: "Presets " }).click();
await page.getByRole("menuitem", { name: "This year" }).click();
const downloadPromise = page.waitForEvent("download");

await page.getByRole("link").filter({ hasText: "XLS" }).first().click();

const download = await downloadPromise;
await download.saveAs(`${choice.replace(/ /g, "_")}.xlsx`);

console.log(
  `Download completed. File saved as ${choice.replace(/ /g, "_")}.xlsx`
);

await browser.close();
