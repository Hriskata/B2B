// Creates an admin account from the terminal (phase 1; inviting admins from
// the admin panel is an open decision and comes later).
//
//   npm run admin:create -- --email someone@example.com --role editor
//
// The password is typed in the terminal (hidden) and never goes through
// command-line arguments or logs. 2FA is set up by the admin at first login.
import { createInterface } from "node:readline";
import { hash } from "@node-rs/argon2";
import { createDb } from "../src/db/create";
import { admins } from "../src/db/schema";
import { validatePassword } from "../src/lib/password-policy";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

// One readline for all questions, so piped input (CI, automation) works too.
// Typed characters are not echoed when stdin is a terminal.
function createPrompt() {
  const isTty = !!process.stdin.isTTY;
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: isTty });
  const echo = rl as unknown as { _writeToOutput: (s: string) => void };
  let muted = false;
  echo._writeToOutput = (s: string) => {
    if (!muted) process.stdout.write(s);
  };

  const buffered: string[] = [];
  const waiting: ((line: string) => void)[] = [];
  rl.on("line", (line) => {
    const next = waiting.shift();
    if (next) next(line);
    else buffered.push(line);
  });
  rl.on("close", () => {
    for (const next of waiting.splice(0)) next("");
  });

  return {
    ask(question: string): Promise<string> {
      process.stdout.write(question);
      muted = isTty;
      return new Promise<string>((resolve) => {
        const done = (line: string) => {
          muted = false;
          process.stdout.write("\n");
          resolve(line);
        };
        const ready = buffered.shift();
        if (ready !== undefined) done(ready);
        else waiting.push(done);
      });
    },
    close: () => rl.close(),
  };
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const role = arg("role");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (role !== "viewer" && role !== "editor")) {
    console.error("Usage: npm run admin:create -- --email <email> --role <viewer|editor>");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set (use the .env file).");
    process.exit(1);
  }

  const prompt = createPrompt();
  const password = await prompt.ask("Password: ");
  const confirm = await prompt.ask("Repeat password: ");
  prompt.close();
  if (password !== confirm) {
    console.error("Passwords do not match.");
    process.exit(1);
  }
  const check = validatePassword(password, { email });
  if (!check.ok) {
    console.error(check.message);
    process.exit(1);
  }

  const { db, client } = createDb(url, { max: 1 });
  try {
    await db.insert(admins).values({ email, role, passwordHash: await hash(password) });
    console.log(`Admin ${email} (${role}) created. 2FA is set up at first login at /admin/login.`);
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } }).code ??
      (error as { cause?: { code?: string } }).cause?.code;
    console.error(code === "23505" ? "An admin with this email already exists." : "Could not create the admin.");
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
