import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                Build Your Company
              </span>
              <br />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                with AI
              </span>
            </h1>
            <p className="mt-8 text-xl sm:text-2xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
              From idea to operational business in 30-90 days. Our AI swarms
              handle legal, product, growth, sales, finance, and customer
              success.
            </p>
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/build"
                className="btn-primary text-lg px-8 py-4 inline-block"
              >
                Start Building
              </Link>
              <a
                href="#how-it-works"
                className="btn-secondary text-lg px-8 py-4 inline-block"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-indigo-400">
                &lt; 30 days
              </div>
              <div className="mt-2 text-sm text-gray-400">
                Average Build Time
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-purple-400">
                $500
              </div>
              <div className="mt-2 text-sm text-gray-400">
                Average Cost
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-cyan-400">
                6
              </div>
              <div className="mt-2 text-sm text-gray-400">
                AI Swarms
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-emerald-400">
                50+
              </div>
              <div className="mt-2 text-sm text-gray-400">
                API Integrations
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">How It Works</h2>
            <p className="mt-4 text-lg text-gray-400">
              Three simple steps to your fully operational company
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="card relative">
              <div className="absolute -top-4 left-6 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div className="pt-4">
                <h3 className="text-xl font-semibold mb-3">
                  Describe Your Idea
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  Tell us about your business idea, target market, and goals.
                  Our AI analyzes your concept and creates a comprehensive
                  build plan covering all aspects of your company.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="card relative">
              <div className="absolute -top-4 left-6 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div className="pt-4">
                <h3 className="text-xl font-semibold mb-3">
                  AI Builds Everything
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  Six specialized AI swarms work in parallel: Legal handles
                  incorporation and compliance, Product builds your MVP,
                  Growth sets up marketing, Sales creates pipelines, Finance
                  manages accounts, and Customer Success prepares support.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="card relative">
              <div className="absolute -top-4 left-6 w-8 h-8 bg-cyan-600 rounded-full flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div className="pt-4">
                <h3 className="text-xl font-semibold mb-3">
                  Launch and Grow
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  Review your fully built company dashboard with all systems
                  operational. Your legal entity is formed, product is live,
                  marketing is running, and customer support is ready.
                  You are in business.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Ready to Build Your Company?
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Join the future of company creation. Let AI handle the complexity
            while you focus on your vision.
          </p>
          <div className="mt-8">
            <Link
              href="/build"
              className="btn-primary text-lg px-10 py-4 inline-block"
            >
              Start Building Now
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500">
              ACBI - Autonomous Company Building Infrastructure
            </div>
            <div className="text-sm text-gray-500">
              Built with AI, for builders.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
