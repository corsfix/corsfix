import { Logo } from "./Logo";
import { MainNav } from "./main-nav";
import { UserNav } from "./user-nav";

export default function Nav() {
  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <Logo className="w-8 min-w-8 drop-shadow-md" />
        <MainNav className="mx-6" />
        <div className="ml-auto flex items-center space-x-4">
          <UserNav />
        </div>
      </div>
    </div>
  );
}
