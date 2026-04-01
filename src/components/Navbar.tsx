import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bell, Search } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Link, useLocation } from "react-router-dom"

const navItems = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Markets", path: "/markets" },
  { name: "Portfolio", path: "/portfolio" },
  { name: "Analysis", path: "/analysis" },
]

const Navbar = () => {
  const location = useLocation()

  return (
    <div className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-350 items-center justify-between px-6">
        {/* LEFT */}
        <div className="flex items-center gap-10">
          {/* Logo */}
          <Link to="/" className="group flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight text-white transition group-hover:opacity-80">
              Coinwave<span className="text-white/40">.</span>
            </span>
          </Link>

          {/* Nav */}
          <div className="hidden items-center gap-2 rounded-xl bg-white/5 p-1 md:flex">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path

              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`relative rounded-lg px-4 py-1.5 text-sm transition ${
                    isActive ? "text-white" : "text-white/50 hover:text-white"
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-0 rounded-lg bg-white/10 backdrop-blur-sm" />
                  )}

                  <span className="relative z-10">{item.name}</span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* CENTER */}
        <div className="relative hidden w-85 lg:block">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search BTC, ETH..."
            className="h-10 rounded-xl border-white/10 bg-white/5 pl-9 text-sm text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20"
          />
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white/60 transition-all hover:bg-white/10 hover:text-white">
                <Bell className="h-5 w-5" />

                {/* Notification dot */}
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-green-500 ring-2 ring-black" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-72 rounded-xl border border-white/10 bg-neutral-900 p-1"
            >
              <DropdownMenuGroup>
                <DropdownMenuItem className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white">
                  BTC crossed $70K 🚀
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white">
                  ETH fees dropping
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white">
                  SOL +5% today
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* User */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-white/10">
                <Avatar className="h-8 w-8 ring-1 ring-white/10">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>

                <span className="text-sm font-medium text-white/70">Admin</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-40 rounded-xl border-white/10 bg-neutral-900"
            >
              <DropdownMenuGroup>
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem>Logout</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

export default Navbar
