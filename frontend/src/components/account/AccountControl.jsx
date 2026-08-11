import { useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/providers/auth-provider'
import LoginDialog from './LoginDialog'

function resolveDisplayName(user) {
  const metadata = user?.user_metadata ?? {}
  return (
    metadata.full_name ||
    metadata.name ||
    user?.email?.split('@')[0] ||
    'Account'
  )
}

// No shadcn Avatar component is installed yet, and one control is not
// reason enough to add it — this is the small presentation it would offer.
function AccountAvatar({ user, displayName }) {
  const [imgError, setImgError] = useState(false)
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="size-6 shrink-0 rounded-full object-cover"
      />
    )
  }

  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
      {displayName.charAt(0).toUpperCase() || '?'}
    </span>
  )
}

export default function AccountControl() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    // Reserves roughly the same footprint as the signed-out button so the
    // header doesn't jump once the session check resolves.
    return <Skeleton className="h-8 w-20 rounded-lg" aria-hidden="true" />
  }

  if (!user) {
    return <LoginDialog trigger={<Button size="sm">Log in</Button>} />
  }

  const displayName = resolveDisplayName(user)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="h-8 gap-1.5 pr-2 pl-1.5" />}
      >
        <AccountAvatar user={user} displayName={displayName} />
        <span className="hidden max-w-[9rem] truncate sm:inline">{displayName}</span>
        <ChevronDown className="hidden size-3.5 opacity-60 sm:block" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-1.5 py-1">
          <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
          {user.email && (
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
