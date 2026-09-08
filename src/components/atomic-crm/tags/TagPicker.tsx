import { Plus } from "lucide-react";
import { useTranslate } from "ra-core";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Tag } from "../types";
import { useTags } from "./useTags";

type TagPickerProps = {
  excludedIds?: number[];
  selectedTagIds?: number[];
  disabled?: boolean;
  onSelect(tag: Tag): void;
  onCreate(): void;
};

export function TagPicker({
  excludedIds,
  selectedTagIds,
  disabled,
  onSelect,
  onCreate,
}: TagPickerProps) {
  const translate = useTranslate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [debouncedSearch]);

  const {
    data,
    isPending,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    error,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useTags({ search: debouncedSearch, excludedIds });
  const tags = data?.pages.flatMap((page) => page.data) ?? [];
  const isSearching = search.trim() !== debouncedSearch || isPending;

  const results = (
    <>
      {isSearching ? (
        <p role="status" className="p-3 text-sm text-muted-foreground">
          {translate("crm.common.loading")}
        </p>
      ) : (
        tags.map((tag) =>
          selectedTagIds ? (
            <div
              key={tag.id}
              className="flex items-center gap-2 rounded-sm px-2 py-2 hover:bg-accent cursor-pointer"
              onClick={() => onSelect(tag)}
            >
              <Checkbox
                checked={selectedTagIds.includes(tag.id)}
                disabled={disabled}
                aria-label={tag.name}
                onClick={(event) => event.stopPropagation()}
                onCheckedChange={() => onSelect(tag)}
              />
              <Badge
                variant="secondary"
                className="text-sm font-normal text-black whitespace-normal break-words"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </Badge>
            </div>
          ) : (
            <CommandItem
              key={tag.id}
              value={String(tag.id)}
              disabled={disabled}
              onSelect={() => onSelect(tag)}
            >
              <Badge
                variant="secondary"
                className="text-sm font-normal text-black whitespace-normal break-words"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </Badge>
            </CommandItem>
          ),
        )
      )}
      {!isSearching && !error && tags.length === 0 && (
        <p role="status" className="p-3 text-sm text-muted-foreground">
          {translate(
            debouncedSearch
              ? "resources.tags.picker.no_results"
              : "resources.tags.picker.empty",
          )}
        </p>
      )}
    </>
  );

  return (
    <div className="min-w-0">
      {selectedTagIds ? (
        <>
          <Input
            type="search"
            autoFocus
            aria-label={translate("resources.tags.picker.search")}
            placeholder={translate("resources.tags.picker.search")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={disabled}
          />
          <div
            ref={listRef}
            role="group"
            aria-label={translate("resources.tags.name", { smart_count: 2 })}
            className="max-h-60 overflow-y-auto mt-2"
            aria-busy={isSearching || isFetching}
          >
            {results}
          </div>
        </>
      ) : (
        <Command shouldFilter={false}>
          <CommandInput
            autoFocus
            aria-label={translate("resources.tags.picker.search")}
            placeholder={translate("resources.tags.picker.search")}
            value={search}
            onValueChange={setSearch}
            disabled={disabled}
          />
          <CommandList
            ref={listRef}
            className="max-h-60"
            aria-busy={isSearching || isFetching}
          >
            {results}
          </CommandList>
        </Command>
      )}
      {error && !isSearching && (
        <div className="p-2">
          <p role="alert" className="text-sm text-destructive">
            {translate("resources.tags.picker.error")}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isFetching}
            onClick={() => {
              if (isFetchNextPageError) void fetchNextPage();
              else void refetch();
            }}
          >
            {translate("resources.tags.picker.retry")}
          </Button>
        </div>
      )}
      {hasNextPage && !isSearching && !error && (
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={disabled || isFetching}
          onClick={() => void fetchNextPage()}
        >
          {translate(
            isFetchingNextPage
              ? "crm.common.loading"
              : "resources.tags.picker.load_more",
          )}
        </Button>
      )}
      <div className="border-t p-2">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start"
          disabled={disabled}
          onClick={onCreate}
        >
          <Plus />
          {translate("resources.tags.action.create")}
        </Button>
      </div>
    </div>
  );
}
