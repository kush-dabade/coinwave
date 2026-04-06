import { BrowserRouter, Routes, Route } from "react-router-dom"

import Dashboard from "./pages/Dashboard"
import Footer from "./components/Footer"
import Navbar from "./components/Navbar"
import PortfolioPage from "./pages/portfolio" // adjust path if needed
import Markets from "./pages/Markets"
import Analysis from "./pages/Analysis"

export function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-svh py-2">
        <div className="w-full">
          <Navbar />

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/analysis" element={<Analysis />} />
          </Routes>

          <Footer />
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
