"use client";

import Link from "next/link";

const DOWNLOAD_URL =
  "https://github.com/Fasinu-David-Omotayo/NEXUS-AI/releases/latest/download/NexusAI-Setup.exe";

const steps = [
  {
    number: "01",
    title: "Download the installer",
    description:
      "Select the Windows download button and save NexusAI-Setup.exe to your computer.",
  },
  {
    number: "02",
    title: "Install Nexus AI Desktop",
    description:
      "Open the downloaded file and follow the setup prompts. Windows may ask you to confirm that you want to run the installer.",
  },
  {
    number: "03",
    title: "Open the companion",
    description:
      "Launch Nexus AI Desktop when setup finishes. It runs in the Windows notification area near the clock. If you do not see its icon, check the hidden-icons arrow.",
  },
  {
    number: "04",
    title: "Sign in and open Desktop devices",
    description:
      "Sign in to your Nexus AI account in the website, then open Dashboard → Desktop devices.",
  },
  {
    number: "05",
    title: "Start pairing on Windows",
    description:
      "Right-click the Nexus AI tray icon and select “Pair / Re-pair this computer”. Keep the pairing window open.",
  },
  {
    number: "06",
    title: "Generate and enter your code",
    description:
      "On the Desktop devices page, enter a device name and generate a one-time pairing code. Enter that code in the Windows pairing window before it expires.",
  },
];

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-[#101110] text-[#f1f1eb]">
      <header className="border-b border-white/[0.08]">
        <nav className="mx-auto flex h-[68px] max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-[17px] font-semibold tracking-[-0.6px]">
            nexus<span className="text-[#b8c9a8]">ai</span>
          </Link>
          <Link href="/login" className="text-[13px] text-[#b8c9a8] transition hover:text-white">
            Sign in ↗
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
        <section className="max-w-3xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#b8c9a8]">
            NEXUS AI · WINDOWS COMPANION
          </p>
          <h1 className="mt-4 text-4xl font-medium tracking-[-1.8px] sm:text-5xl">
            Bring Nexus AI to your desktop.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#a5a69e] sm:text-base">
            Install the Windows companion to connect your computer to your
            Nexus AI account and use supported desktop actions remotely.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={DOWNLOAD_URL}
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#e4e5da] px-6 text-sm font-semibold text-[#171813] transition hover:bg-white"
            >
              Download for Windows <span className="ml-2" aria-hidden="true">↓</span>
            </a>
            <a
              href="#installation"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/15 px-6 text-sm text-[#e4e5da] transition hover:bg-white/[0.05]"
            >
              View installation guide
            </a>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#777970]">
            Windows 10 and 11 · The companion must be installed on the computer you want to control.
          </p>
        </section>

        <section id="installation" className="mt-16 border-t border-white/[0.09] pt-10">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#b8c9a8]">
            GETTING STARTED
          </p>
          <h2 className="mt-3 text-2xl font-medium tracking-[-0.8px]">
            Install and connect in six steps.
          </h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {steps.map((step) => (
              <article key={step.number} className="rounded-xl border border-white/[0.09] bg-white/[0.02] p-5 sm:p-6">
                <p className="text-xs text-[#b8c9a8]">{step.number}</p>
                <h3 className="mt-4 text-base font-medium">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#a0a197]">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-xl border border-white/[0.10] bg-[#171814] p-5 sm:p-7">
          <h2 className="text-lg font-medium">A few important things</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[#a5a69e]">
            <li>• Pairing codes are single-use and expire after 10 minutes.</li>
            <li>• Only enter your code in the pairing window on the computer you are authorizing. Never share it with anyone.</li>
            <li>• Each computer is linked to your own signed-in account. You can review or revoke access under Dashboard → Desktop devices.</li>
            <li>• Keep Nexus AI Desktop running in the Windows notification area while you want the computer connected.</li>
          </ul>
        </section>

        <section className="mt-10 border-t border-white/[0.09] pt-8">
          <h2 className="text-lg font-medium">Already installed?</h2>
          <p className="mt-2 text-sm leading-6 text-[#a0a197]">
            Open Desktop devices in your account to generate a fresh pairing code or manage computers already connected to your account.
          </p>
          <Link href="/dashboard/devices" className="mt-4 inline-flex text-sm text-[#b8c9a8] transition hover:text-white">
            Go to Desktop devices ↗
          </Link>
        </section>

        <footer className="mt-14 border-t border-white/[0.08] pt-6 text-xs text-[#777970]">
          <Link href="/" className="transition hover:text-white">← Back to Nexus AI</Link>
        </footer>
      </div>
    </main>
  );
}
