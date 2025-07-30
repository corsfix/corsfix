import { Logo } from "./Logo";
import { MainNav } from "./main-nav";
import { UserNav } from "./user-nav";

export default function Nav() {
  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <Logo className="size-9" />
        <MainNav className="mx-6" />
        <div className="ml-auto flex items-center space-x-4">
          <UserNav />
        </div>
      </div>
    </div>
  );
}
