
import Link from "next/link";

const features = [
  {
    number: "01",
    icon: "message-square",
    title: "AI conversations",
    description:
      "Think through ideas, ask questions, and get useful answers with your AI assistant.",
  },
  {
    number: "02",
    icon: "files",
    title: "Research and documents",
    description:
      "Build a more organized research workflow and make complex information easier to understand.",
  },
  {
    number: "03",
    icon: "workflow",
    title: "Intelligent automation",
    description:
      "Bring repetitive tasks and connected workflows into a more streamlined workspace.",
  },
  {
    number: "04",
    icon: "monitor",
    title: "Desktop assistance",
    description:
      "Connect your local desktop agent to supported computer tasks while keeping local controls on your device.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#101110] text-[#f1f1eb]">
      {/* Navigation */}
      <header className="border-b border-white/[0.08]">
        <nav className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e4e5da] text-[#151612]">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M5 5h14v14H5z" />
                <path d="M9 9h6v6H9z" />
              </svg>
            </span>
            <span className="text-[17px] font-semibold tracking-[-0.6px]">
              nexus<span className="text-[#b8c9a8]">ai</span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            <a
              href="#platform"
              className="text-[13px] text-[#a3a59c] transition hover:text-white"
            >
              Platform
            </a>
            <a
              href="#features"
              className="text-[13px] text-[#a3a59c] transition hover:text-white"
            >
              Features
            </a>
            <a
              href="#about"
              className="text-[13px] text-[#a3a59c] transition hover:text-white"
            >
              About
            </a>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3.5 py-2 text-[13px] font-medium transition hover:border-white/30 hover:bg-white/[0.05]"
          >
            Sign in
            <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section id="platform" className="relative">
        <div className="pointer-events-none absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-[#a6bb91]/[0.07] blur-[100px]" />

        <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-20 sm:px-8 sm:pb-20 sm:pt-28 lg:px-12 lg:pt-32">
          <div className="mx-auto max-w-3xl text-center">
           

            <h1 className="text-[38px] font-medium leading-[1.12] tracking-[-1.8px] sm:text-[52px] sm:tracking-[-2.6px] lg:text-[64px] lg:tracking-[-3.2px]">
              Less busywork.
              <br />
              <span className="text-[#b8c9a8]">More possibilities.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-[14px] leading-7 text-[#a5a69e] sm:text-[15px]">
              One intelligent workspace for AI conversations, research, and
              smarter workflows. Spend less time switching tools and more time
              making progress.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#e4e5da] px-5 text-[13px] font-semibold text-[#171813] transition hover:bg-white sm:w-auto"
              >
                Get started
                <span aria-hidden="true">↗</span>
              </Link>

              <a
                href="#features"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-white/[0.13] px-5 text-[13px] font-medium text-[#e4e5da] transition hover:border-white/25 hover:bg-white/[0.04] sm:w-auto"
              >
                Explore the platform
              </a>
            </div>

            <p className="mt-5 text-[11px] text-[#777970]">
              A focused workspace for the way you work.
            </p>
          </div>

          {/* Product preview */}
          <div className="mx-auto mt-16 max-w-4xl sm:mt-20">
            <div className="overflow-hidden rounded-xl border border-white/[0.12] bg-[#151613] shadow-2xl shadow-black/20">
              <div className="flex h-11 items-center justify-between border-b border-white/[0.08] px-4 sm:px-5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#777a6e]" />
                  <span className="h-2 w-2 rounded-full bg-[#777a6e]" />
                  <span className="h-2 w-2 rounded-full bg-[#777a6e]" />
                </div>
                <span className="text-[10px] tracking-wide text-[#777970]">
                  NEXUS AI WORKSPACE
                </span>
                <div className="h-5 w-5" />
              </div>

              <div className="grid min-h-[260px] sm:grid-cols-[190px_1fr]">
                <aside className="hidden border-r border-white/[0.08] p-4 sm:block">
                  <div className="mb-6 flex items-center gap-2 text-[12px] font-medium text-[#e4e5da]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.07]">
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        aria-hidden="true"
                      >
                        <path d="M12 3v18M3 12h18" />
                      </svg>
                    </span>
                    Workspace
                  </div>

                  <p className="mb-3 text-[9px] font-medium uppercase tracking-[0.15em] text-[#777970]">
                    YOUR TOOLS
                  </p>

                  {[
                    "AI Assistant",
                    "Research",
                    "Documents",
                    "Automations",
                  ].map((item, index) => (
                    <div
                      key={item}
                      className={`mb-1 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[11px] ${
                        index === 0
                          ? "bg-white/[0.07] text-[#f1f1eb]"
                          : "text-[#909188]"
                      }`}
                    >
                      <span className="text-[12px] text-[#b8c9a8]">
                        {["✳", "⌕", "▤", "⌘"][index]}
                      </span>
                      {item}
                    </div>
                  ))}
                </aside>

                <div className="flex flex-col justify-between p-5 sm:p-7">
                  <div>
                    <p className="text-[10px] text-[#8c8e83]">
                      YOUR WORKSPACE / AI ASSISTANT
                    </p>
                    <h2 className="mt-3 text-[20px] font-medium tracking-[-0.5px] text-[#f1f1eb] sm:text-[23px]">
                      What are we working on?
                    </h2>
                    <p className="mt-2 max-w-md text-[12px] leading-6 text-[#92948a]">
                      Explore an idea, work through a problem, or start
                      something new. Your assistant is ready when you are.
                    </p>
                  </div>

                  <div className="mt-8 rounded-lg border border-white/[0.11] bg-[#1b1c18] p-3.5">
                    <p className="text-[11px] text-[#777970]">
                      Ask Nexus anything...
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex gap-2">
                        <span className="rounded-md border border-white/[0.09] px-2 py-1 text-[9px] text-[#92948a]">
                          Research
                        </span>
                        <span className="rounded-md border border-white/[0.09] px-2 py-1 text-[9px] text-[#92948a]">
                          Ideas
                        </span>
                      </div>
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#e4e5da] text-sm text-[#171813]">
                        ↑
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-center text-[9px] text-[#686a61]">
                    Interface preview · Sign in to access your workspace
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="border-t border-white/[0.08] bg-[#131411] py-16 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="mb-9 max-w-xl">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#b8c9a8]">
              BUILT FOR YOUR WORKFLOW
            </p>
            <h2 className="mt-3 text-[26px] font-medium tracking-[-0.9px] sm:text-[32px]">
              Everything in one place.
            </h2>
            <p className="mt-3 text-[13px] leading-6 text-[#a0a197]">
              The tools you need, brought together in one considered
              workspace.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <article
                key={feature.number}
                className="rounded-xl border border-white/[0.09] bg-white/[0.018] p-5 transition hover:border-white/[0.17] hover:bg-white/[0.035] sm:p-6"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.10] text-[#b8c9a8]">
                    {feature.number === "01" && (
                      <span className="text-base">✳</span>
                    )}
                    {feature.number === "02" && (
                      <span className="text-base">⌕</span>
                    )}
                    {feature.number === "03" && (
                      <span className="text-base">⌘</span>
                    )}
                    {feature.number === "04" && (
                      <span className="text-base">▣</span>
                    )}
                  </span>
                  <span className="text-[10px] text-[#66685f]">
                    {feature.number}
                  </span>
                </div>

                <h3 className="mt-5 text-[15px] font-medium tracking-[-0.2px]">
                  {feature.title}
                </h3>
                <p className="mt-2 max-w-md text-[12px] leading-6 text-[#999b91]">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section id="about" className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-14 sm:px-8 md:flex-row md:items-center lg:px-12">
          <div>
            <h2 className="text-[23px] font-medium tracking-[-0.7px]">
              Ready to work a little smarter?
            </h2>
            <p className="mt-2 text-[12px] leading-6 text-[#999b91]">
              Your next idea can start here.
            </p>
          </div>

          <Link
            href="/login"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#e4e5da] px-4 text-[12px] font-semibold text-[#171813] transition hover:bg-white"
          >
            Open Nexus AI
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 text-[11px] text-[#777970] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p>
            <span className="font-medium text-[#d5d6cd]">nexusai</span>
            {" "}· Your intelligent workspace
          </p>
          <p>Built for focused work and better ideas.</p>
        </div>
      </footer>
    </main>
  );
}
