import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./components/Dashboard";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import PortfolioPage from "./pages/portfolio"; // adjust path if needed

export function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-svh py-2 px-2">
        <div className="w-full">
          <Navbar />

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
          </Routes>

          <Footer />
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;