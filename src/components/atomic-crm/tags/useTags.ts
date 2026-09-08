import { useInfiniteGetList } from "ra-core";
import escapeRegExp from "lodash/escapeRegExp";

import type { Tag } from "../types";

type UseTagsOptions = {
  enabled?: boolean;
  search?: string;
  excludedIds?: number[];
};

export function useTags({
  enabled,
  search = "",
  excludedIds = [],
}: UseTagsOptions = {}) {
  return useInfiniteGetList<Tag>(
    "tags",
    {
      pagination: { page: 1, perPage: 25 },
      sort: { field: "name", order: "ASC" },
      filter: {
        // A literal, case-insensitive substring search. imatch also avoids the
        // provider splitting multiword ilike searches into invalid URL keys.
        ...(search ? { "name@imatch": escapeRegExp(search) } : {}),
        ...(excludedIds.length
          ? { "id@not.in": `(${excludedIds.join(",")})` }
          : {}),
      },
    },
    // Discard unused pages so reopening the picker starts with one page.
    { enabled, retry: false, gcTime: 0 },
  );
}
