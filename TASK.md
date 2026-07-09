# Work Trial — School Portal Platform

Welcome, and thanks for making the time. This is a **practical, hands-on work trial inside a full
operating system** running in your browser, **pre-configured with every tool
this test needs**: VS Code, a terminal, Chrome, Docker, Node 20, Python and an AI coding assistant. Nothing
to install, nothing to set up — sign in and build.

Treat this like your **first sprint on an existing team**: you've been handed a
greenfield ticket, the tools are set up, and we care about how you work, not whether you reach the
finish line.

> We are looking at **how far you get and how you get there**: how you prioritize,
> how you drive the AI assistant, how you verify your own work, and how cleanly you commit.
> Go as far as you can; leave the rest in a short handoff note.

---

## The product

Build a **Canvas-style school portal** — the full requirements are in **`SPECS.md`** (open it next).
In one line: three roles (Admin / Teacher / Student), classes, assignments, submissions, grading, and
a small public stats API, on Next.js + Fastify + Postgres + Redis.

## What's already set up for you

- **Node 20, the editor, Claude Code, and Chrome** are ready in the dock.
- **`npm install` is already done** — `node_modules` (incl. Playwright's browser) is present. Don't
  re-run it unless you add a dependency.
- **Docker works in here.** `docker compose up -d` starts Postgres 17 + Redis 7 (images are
  pre-pulled, so it's fast). The compose file is in the repo.
- This folder is a **fresh git repo** with one initial commit. **Commit as you go** — your commit
  history is part of what we review, and the timestamps help us follow your work.

## AI access

**Claude Code is already installed and configured** — open a terminal and run `claude`; there is no
login, no API key to paste, nothing to set up. It works out of the box.

You have a **$50 usage budget for this task**, enforced on the API key itself. Claude Code's
status bar shows a running **"AI budget: $X of $50 used"** estimate so you always know where you
stand. $50 is plenty for the whole sprint if you spend it deliberately — and running dry mid-sprint
is a self-inflicted wound. Use it wisely:

- **Pick the right model for the job** (`/model` inside Claude Code): a cheaper, faster model for
  boilerplate, scaffolding, and mechanical edits; the strongest model only for the decisions that
  deserve it (schema design, auth, tricky debugging).
- **Scope your prompts.** Small, well-specified tasks burn less budget and produce better output
  than "build the whole app" mega-prompts that you then have to unwind.

How you drive the assistant, what you delegate, what you verify, how you course-correct, is part
of what we evaluate.

## Deployments (AWS)

**AWS access is included in this assessment.** The AWS CLI is installed and credentials are already
configured in the session — `aws sts get-caller-identity` will confirm you're signed in. You can use
it to **deploy your services and show them running in the cloud**: for example, stand up an
instance, run your Docker Compose stack on it, and hit your stats API over the internet.

- **Region: everything is locked to `us-east-1`** — your credentials already default to it, so just
  deploy there (no `--region` needed). Other regions and GPU/oversized instances are blocked, so a
  stray `AccessDenied`/`UnauthorizedOperation` almost always means a wrong-region or too-large
  instance, not a broken credential. Stick to `t3`/`t4g` sizes.
- **Connecting to an instance:** SSH on port 22 isn't available here. Launch with
  `--iam-instance-profile Name=sandbox-ssm-instance` and connect via **SSM Session Manager**
  (`aws ssm start-session --target <instance-id>`) or EC2 Instance Connect.
- **Scripting AWS:** the **AWS CLI** and **Python `boto3`** are the supported way to call AWS from
  code here. (The Node `aws-sdk-js` won't reach AWS from inside the session — use the CLI/boto3 or
  run your AWS calls on the EC2 instance itself.)

### Working in the browser desktop
- Click the **fullscreen** button in the session toolbar and use a **Chromium** browser (Chrome/Edge)
  on your side. In fullscreen, keyboard shortcuts like **⌘/Ctrl+W, ⌘/Ctrl+T, ⌘/Ctrl+N** go to the
  desktop *inside* the session instead of your own browser. Outside fullscreen, your local browser
  will grab them.
- Mac users: your ⌘ shortcuts are mapped to Ctrl inside the session. In a terminal, ⌘C sends an
  interrupt (use ⌘⇧C to copy); switch apps with ⌥Tab.


## The walkthrough call (required)

At the end of the trial you'll **get on a call with the Cruitical team** for a **5–10 minute
walkthrough of your work — it is part of the assessment**, weighted alongside the code itself.
You'll share your screen and talk us through:

- **The application** — click through what works, in the UI and/or the API.
- **Your architecture and thought process** — how the pieces fit together, what you chose and why,
  and what you'd do differently with more time. A quick diagram helps a lot — **Excalidraw**
  (open [excalidraw.com](https://excalidraw.com) in Chrome inside the session) is right there for
  sketching your architecture.
- **What you'd tackle next** — the same content as your handoff note, out loud.

## When you're done

- Make sure your work is **committed**.
- Add a short **`HANDOFF.md`**: what you finished, what you'd do next, and any decisions or trade-offs
  you want us to know about. A candidate who ships less but explains their reasoning well scores well.

Good luck — build the way you actually work!
