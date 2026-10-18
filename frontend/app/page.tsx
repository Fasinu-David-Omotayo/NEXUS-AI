export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* NAVBAR */}
      <nav className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <h1 className="text-xl font-bold tracking-wide">
            Nexus AI
          </h1>

          <div className="hidden gap-8 md:flex">
            <a href="#" className="text-zinc-400 hover:text-white">
              Features
            </a>

            <a href="#" className="text-zinc-400 hover:text-white">
              Platform
            </a>

            <a href="#" className="text-zinc-400 hover:text-white">
              Research
            </a>
          </div>

          <button className="rounded-xl bg-white px-4 py-2 text-black font-medium">
            Sign In
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="flex min-h-[80vh] items-center justify-center px-6">
        <div className="max-w-5xl text-center">
          <p className="mb-6 text-sm uppercase tracking-[0.4em] text-zinc-500">
            Intelligent Automation Platform
          </p>

          <h1 className="mb-8 text-6xl font-bold leading-tight md:text-8xl">
            AI That Works
            <br />
            Beyond Conversation
          </h1>

          <p className="mx-auto mb-10 max-w-3xl text-lg text-zinc-400 md:text-xl">
            Chat with AI, analyze documents, automate workflows,
            and control your digital environment through one
            intelligent platform.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <button className="rounded-2xl bg-white px-8 py-4 font-medium text-black">
              Launch Assistant
            </button>

            <button className="rounded-2xl border border-zinc-700 px-8 py-4">
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-t border-zinc-900 py-20">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-3">
          <div className="rounded-3xl border border-zinc-800 p-8">
            <h2 className="mb-2 text-4xl font-bold">100+</h2>
            <p className="text-zinc-400">
              Intelligent Operations
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-800 p-8">
            <h2 className="mb-2 text-4xl font-bold">24/7</h2>
            <p className="text-zinc-400">
              AI Availability
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-800 p-8">
            <h2 className="mb-2 text-4xl font-bold">1</h2>
            <p className="text-zinc-400">
              Unified Platform
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-16 text-center text-5xl font-bold">
            Core Features
          </h2>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-3xl border border-zinc-800 p-8">
              <h3 className="mb-4 text-2xl font-semibold">
                AI Conversations
              </h3>

              <p className="text-zinc-400">
                Powered by Gemini AI for intelligent responses,
                research assistance, and productivity support.
              </p>
            </div>

            <div className="rounded-3xl border border-zinc-800 p-8">
              <h3 className="mb-4 text-2xl font-semibold">
                Document Analysis
              </h3>

              <p className="text-zinc-400">
                Upload documents and receive summaries,
                explanations, and extracted insights instantly.
              </p>
            </div>

            <div className="rounded-3xl border border-zinc-800 p-8">
              <h3 className="mb-4 text-2xl font-semibold">
                Voice Interaction
              </h3>

              <p className="text-zinc-400">
                Speak naturally and interact with the assistant
                through voice-enabled communication.
              </p>
            </div>

            <div className="rounded-3xl border border-zinc-800 p-8">
              <h3 className="mb-4 text-2xl font-semibold">
                Desktop Automation
              </h3>

              <p className="text-zinc-400">
                Connect a local automation agent to launch apps,
                manage workflows, and streamline tasks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-900 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="mb-6 text-5xl font-bold">
            One Platform.
            <br />
            Infinite Possibilities.
          </h2>

          <p className="mb-10 text-zinc-400">
            Experience the next generation of AI-powered
            productivity and automation.
          </p>

          <button className="rounded-2xl bg-white px-10 py-4 font-medium text-black">
            Get Started
          </button>
        </div>
      </section>
    </main>
  );
}