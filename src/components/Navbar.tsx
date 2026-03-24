import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bell, Search } from "lucide-react"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const Navbar = () => {
  return (
    <div className="flex w-full items-center justify-between border-b border-white/10 py-2 px-2">
      {/* Left Section */}
      <div className="flex items-center gap-12">
        {/* Logo */}
        <h1 className="text-2xl font-bold tracking-tight">Coinwave.</h1>

        {/* Search */}
        <div className="relative w-200">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search Coins, Markets, News ..."
            className="border-white/10 bg-white/5 pl-9 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      </div>
      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5 text-gray-400" />
        </Button>

        {/* User */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="py-6">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
                <p className="text-sm text-gray-300">Admin User</p>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem>Portfolio</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

export default Navbar
