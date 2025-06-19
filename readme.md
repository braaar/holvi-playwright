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
