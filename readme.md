# holvi-playwright

Why use a web app when you can use a CLI?

With this project you can download reports from the Finnish bank Holvi right in your terminal.

Using [playwright](https://www.npmjs.com/package/playwright), this program launches a headless browser that does all the clicking for you, while you follow the instructions as presented with an [inquirer](https://www.npmjs.com/package/@inquirer/prompts)-built CLI.

This project is in the very early stages, so there are a number of ways the script can be made more robust and feature rich. Feel free to open an issue with bug reports or feature suggestions!

## A word of advice

This program logs into your bank in an invisible browser and has the power to do anything you could do when logged into the bank in your browser. You should read and understand the code before you run it. **Do not let an unknown computer program click around in your web bank!**

## Prerequisites

- [Node.js](https://nodejs.org/en/download) (probably >=18)
- [pnpm](https://pnpm.io/installation) package manager
- A Holvi account and the Holvi mobile app or other 2FA mechanism.

## Running the project

Install dependencies:

```sh
pnpm i
```

Install browsers for playwright:

```sh
pnpm exec playwright install
```

Run the program:

```sh
pnpm start
```

You'll be asked which report you want (general ledger, account statement or accounting journal) and for which year (defaults to last year), and the report for 1 January–31 December of that year is saved as an `.xlsx` file. To watch the browser while it works, run `HEADED=1 pnpm start`.

## Importing the journal into Kilta

[Kilta](https://github.com/HacklabJKL/kilta), Hacklab Jyväskylä's membership register, can import Holvi's accounting journal and credit members' payments from it. Set `KILTA_URL` and, after downloading the accounting journal, the program sends it to Kilta for review, shows what importing it would do (new and known transactions, where the payments go, anything that stops it) and asks whether to import it. Without `KILTA_URL` this step is skipped.

- `KILTA_URL`: the lab's Kilta address, for example `https://kilta.example.org`.
- `KILTA_TOKEN`: a bearer token for a board member or a script client, sent as `Authorization: Bearer $KILTA_TOKEN`. The import API is board only. Not needed against a local Kilta started with `-dev-open`.

```sh
KILTA_URL=https://kilta.example.org KILTA_TOKEN=... pnpm start
```

The lab's very first import also needs the day from which bank payments credit members; the program asks for it when Kilta says it's missing. Importing the same or an overlapping journal again is safe: Kilta stores and posts each transaction once.

To send a journal you downloaded earlier, without logging into Holvi:

```sh
KILTA_URL=https://kilta.example.org KILTA_TOKEN=... pnpm kilta Accounting_journal_2025.xlsx
```
