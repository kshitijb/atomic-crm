import { Plus } from "lucide-react";
import {
  useGetMany,
  useRecordContext,
  useTranslate,
  useUpdate,
  type Identifier,
} from "ra-core";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { TagChip } from "../tags/TagChip";
import { TagCreateModal } from "../tags/TagCreateModal";
import { TagPicker } from "../tags/TagPicker";
import type { Contact, Tag } from "../types";

export const TagsListEdit = () => {
  const record = useRecordContext<Contact>();
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const translate = useTranslate();

  const { data: tags } = useGetMany<Tag>(
    "tags",
    { ids: record?.tags },
    { enabled: record && record.tags && record.tags.length > 0 },
  );
  const [update] = useUpdate<Contact>();

  const handleTagAdd = (id: number) => {
    if (!record) {
      throw new Error("No contact record found");
    }
    const tags = [...(record.tags ?? []), id];
    update("contacts", {
      id: record.id,
      data: { tags },
      previousData: record,
    });
  };

  const handleTagDelete = async (id: Identifier) => {
    if (!record) {
      throw new Error("No contact record found");
    }
    const tags = record.tags.filter((tagId) => tagId !== id);
    await update("contacts", {
      id: record.id,
      data: { tags },
      previousData: record,
    });
  };

  const openTagCreateDialog = () => {
    setPickerOpen(false);
    setOpen(true);
  };

  const handleTagCreateClose = () => {
    setOpen(false);
  };

  const handleTagCreated = useCallback(
    async (tag: Tag) => {
      if (!record) {
        throw new Error("No contact record found");
      }

      await update(
        "contacts",
        {
          id: record.id,
          data: { tags: [...(record.tags ?? []), tag.id] },
          previousData: record,
        },
        {
          onSuccess: () => {
            setOpen(false);
          },
        },
      );
    },
    [update, record],
  );

  if (!record) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {tags?.map((tag) => (
        <div key={tag.id}>
          <TagChip tag={tag} onUnlink={() => handleTagDelete(tag.id)} />
        </div>
      ))}

      <div>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 md:h-6 cursor-pointer"
            >
              <Plus className="w-4 h-4 md:w-3 md:h-3 mr-1" />
              {translate("resources.tags.action.add")}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-80 max-w-[calc(100vw-2rem)] p-0"
          >
            {pickerOpen && (
              <TagPicker
                excludedIds={record.tags}
                onSelect={(tag) => {
                  handleTagAdd(tag.id);
                  setPickerOpen(false);
                }}
                onCreate={openTagCreateDialog}
              />
            )}
          </PopoverContent>
        </Popover>
      </div>

      <TagCreateModal
        open={open}
        onClose={handleTagCreateClose}
        onSuccess={handleTagCreated}
      />
    </div>
  );
};
