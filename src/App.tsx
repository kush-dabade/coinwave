import Dashboard from "./components/Dashboard"
import Navbar from "./components/Navbar"

export function App() {
  return (
    <div className="flex min-h-svh py-2 px-2">
      <div className="w-full">
        <div>
          <Navbar />
          <Dashboard />
        </div>
      </div>
    </div>
  )
}

export default App
