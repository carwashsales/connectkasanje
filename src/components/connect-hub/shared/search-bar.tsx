'use client';

import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";

type SearchBarProps = {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    placeholder?: string;
}

export function SearchBar({ searchTerm, setSearchTerm, placeholder = "Search..." }: SearchBarProps) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        className="pl-10"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </div>
  );
}
