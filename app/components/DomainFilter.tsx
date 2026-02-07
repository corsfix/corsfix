"use client";

import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface DomainFilterProps {
  availableDomains: string[];
  selectedDomains: string[];
  onSelectionChange: (domains: string[]) => void;
}

export function DomainFilter({
  availableDomains,
  selectedDomains,
  onSelectionChange,
}: DomainFilterProps) {
  const handleToggle = (domain: string) => {
    if (selectedDomains.includes(domain)) {
      onSelectionChange(selectedDomains.filter((d) => d !== domain));
    } else {
      onSelectionChange([...selectedDomains, domain]);
    }
  };

  const getButtonLabel = () => {
    if (selectedDomains.length === 0) return "All domains";
    if (selectedDomains.length === 1) return selectedDomains[0];
    return `${selectedDomains.length} domains`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex h-9 w-36 items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring">
          <span className="truncate">{getButtonLabel()}</span>
          <CaretSortIcon className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search domains..." />
          <CommandList>
            <CommandEmpty>No domains found.</CommandEmpty>
            <CommandGroup>
              {availableDomains.map((domain) => {
                const isSelected = selectedDomains.includes(domain);
                return (
                  <CommandItem
                    key={domain}
                    value={domain}
                    onSelect={() => handleToggle(domain)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <CheckIcon className="h-3 w-3" />
                    </div>
                    <span className="truncate">{domain}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
