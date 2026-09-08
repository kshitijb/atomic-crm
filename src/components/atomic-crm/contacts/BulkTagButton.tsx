import { Tag as TagIcon, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  useGetMany,
  useListContext,
  useNotify,
  useRefresh,
  useTranslate,
  useUpdate,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { TagForm } from "../tags/TagForm";
import { useCreateTag } from "../tags/useCreateTag";
import { TagPicker } from "../tags/TagPicker";
import type { Contact, Tag } from "../types";

type BulkTagDialogMode = "select" | "create";

export function BulkTagButton() {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate<Contact>("contacts", undefined, {
    returnPromise: true,
  });
  const createTag = useCreateTag();
  const { onUnselectItems, selectedIds = [] } = useListContext<Contact>();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<BulkTagDialogMode>("select");
  const [isApplying, setIsApplying] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

  const { data: selectedContacts = [], isPending: isPendingContacts } =
    useGetMany<Contact>(
      "contacts",
      { ids: selectedIds },
      { enabled: open && selectedIds.length > 0 },
    );

  const closeDialog = useCallback(() => {
    setOpen(false);
    setMode("select");
    setSelectedTags([]);
  }, []);

  useEffect(() => {
    if (!selectedIds.length && open) {
      closeDialog();
    }
  }, [closeDialog, open, selectedIds.length]);

  const applyTagsToSelection = useCallback(async () => {
    if (!selectedTags.length || isApplying) return;
    const tagIds = selectedTags.map((tag) => tag.id);
    const contactsToUpdate = selectedContacts.filter((contact) =>
      tagIds.some((id) => !contact.tags?.includes(id)),
    );

    setIsApplying(true);

    try {
      await Promise.all(
        contactsToUpdate.map((contact) =>
          update("contacts", {
            id: contact.id,
            data: { tags: [...new Set([...(contact.tags ?? []), ...tagIds])] },
            previousData: contact,
          }),
        ),
      );

      notify(
        contactsToUpdate.length > 0
          ? selectedTags.length === 1
            ? "resources.contacts.bulk_tag.success"
            : "resources.contacts.bulk_tag.success_multiple"
          : "resources.contacts.bulk_tag.noop",
        {
          messageArgs: { smart_count: contactsToUpdate.length },
          type: "success",
        },
      );
      closeDialog();
      onUnselectItems();
      refresh();
    } catch (error) {
      notify("resources.contacts.bulk_tag.error", {
        type: "error",
      });
      console.error("Bulk tag failed:", error);
    } finally {
      setIsApplying(false);
    }
  }, [
    closeDialog,
    update,
    notify,
    onUnselectItems,
    refresh,
    selectedContacts,
    selectedTags,
    isApplying,
  ]);

  const handleCreateTag = async (data: Pick<Tag, "name" | "color">) => {
    const tag = await createTag(data);
    setSelectedTags((previous) => [...previous, tag]);
    setMode("select");
  };

  const toggleTag = (tag: Tag) => {
    setSelectedTags((previous) =>
      previous.some((selected) => selected.id === tag.id)
        ? previous.filter((selected) => selected.id !== tag.id)
        : [...previous, tag],
    );
  };

  if (!selectedIds.length) {
    return null;
  }

  const isBusy = isApplying || isPendingContacts;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => setOpen(true)}
      >
        <TagIcon />
        {translate("resources.contacts.bulk_tag.action")}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isApplying) {
            closeDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {mode === "select" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {translate("resources.contacts.bulk_tag.title")}
                </DialogTitle>
                <DialogDescription>
                  {translate("resources.contacts.bulk_tag.description")}
                </DialogDescription>
              </DialogHeader>

              {selectedTags.length > 0 && (
                <div
                  className="flex flex-wrap gap-2 max-h-24 overflow-y-auto"
                  aria-label={translate(
                    "resources.contacts.bulk_tag.selection",
                  )}
                >
                  {selectedTags.map((tag) => (
                    <Badge
                      key={tag.id}
                      className="text-black font-normal gap-1 whitespace-normal break-words"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                      <button
                        type="button"
                        disabled={isBusy}
                        aria-label={translate(
                          "resources.contacts.bulk_tag.remove",
                          { name: tag.name },
                        )}
                        onClick={() => toggleTag(tag)}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <TagPicker
                disabled={isBusy}
                excludedIds={selectedContacts[0]?.tags?.filter((id) =>
                  selectedContacts.every((contact) =>
                    contact.tags?.includes(id),
                  ),
                )}
                selectedTagIds={selectedTags.map((tag) => tag.id)}
                onSelect={toggleTag}
                onCreate={() => setMode("create")}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isApplying}
                  onClick={closeDialog}
                >
                  {translate("ra.action.cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={isBusy || !selectedTags.length}
                  onClick={applyTagsToSelection}
                >
                  {translate("resources.contacts.bulk_tag.apply", {
                    count: selectedTags.length,
                  })}
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {translate("resources.tags.dialog.create_title")}
                </DialogTitle>
                <DialogDescription>
                  {translate("resources.contacts.bulk_tag.create_description")}
                </DialogDescription>
              </DialogHeader>

              <TagForm
                cancelLabel={translate("resources.contacts.bulk_tag.back")}
                open={open && mode === "create"}
                onCancel={() => setMode("select")}
                onSubmit={handleCreateTag}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
