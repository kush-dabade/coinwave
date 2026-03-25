const Footer = () => {
  return (
    <footer className="mt-10 border-t border-white/10 bg-black/40 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* TOP */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">

          {/* LEFT - BRAND */}
          <div className="flex flex-col items-center md:items-start">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              Coinwave
            </h2>
            <p className="text-xs text-white/50 mt-1">
              Real-time crypto insights & portfolio tracking
            </p>
          </div>

          {/* CENTER - NAV */}
          <div className="flex items-center gap-6 text-sm text-white/50">
            <a href="#" className="hover:text-white transition">
              Dashboard
            </a>
            <a href="#" className="hover:text-white transition">
              Markets
            </a>
            <a href="#" className="hover:text-white transition">
              Portfolio
            </a>
            <a href="#" className="hover:text-white transition">
              Analytics
            </a>
          </div>

          {/* RIGHT - STATUS */}
          <div className="flex flex-col items-center md:items-end text-xs text-white/40">
            <span>Data powered by CoinGecko</span>
            <span className="mt-1">Updated in real-time</span>
          </div>
        </div>

        {/* DIVIDER */}
        <div className="my-6 border-t border-white/10" />

        {/* BOTTOM */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <span>© {new Date().getFullYear()} Coinwave</span>

          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-white transition">
              Privacy
            </a>
            <a href="#" className="hover:text-white transition">
              Terms
            </a>
          </div>
        </div>

      </div>
    </footer>
  )
}

export default Footer