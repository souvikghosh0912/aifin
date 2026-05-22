import { LogOut, User as UserIcon } from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppHeaderProps {
  email: string;
  displayName: string | null;
}

export function AppHeader({ email, displayName }: AppHeaderProps) {
  const initial = (displayName || email).charAt(0).toUpperCase();

  return (
    <header className="flex h-12 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="text-sm font-bold md:hidden">finai</div>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initial}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="text-sm">{displayName ?? "Account"}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/settings">
                <UserIcon className="h-4 w-4" />
                Settings
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={signOut}>
              <button
                type="submit"
                className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
