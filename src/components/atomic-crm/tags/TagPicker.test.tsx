import {
  CoreAdminContext,
  ListContextProvider,
  RecordContextProvider,
  ResourceContextProvider,
  ShowBase,
  memoryStore,
  useList,
} from "ra-core";
import { QueryClient } from "@tanstack/react-query";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import fakeRestDataProvider from "ra-data-fakerest";
import type { ReactNode } from "react";
import { buildContact } from "@/test/StoryWrapper";
import { testI18nProvider } from "../providers/commons/i18nProvider";
import { withSupabaseFilterAdapter } from "../providers/fakerest/internal/supabaseAdapter";
import { BulkTagButton } from "../contacts/BulkTagButton";
import { TagsListEdit } from "../contacts/TagsListEdit";
import { TagPicker } from "./TagPicker";

const tags = Array.from({ length: 205 }, (_, id) => ({
  id,
  name: `Tag ${String(id).padStart(3, "0")}`,
  color: "#ffcc80",
}));
const contacts = [
  buildContact({ id: 1, tags: [0, 204] }),
  buildContact({ id: 2, tags: [0] }),
];
function setup(children: ReactNode, fail?: (page: number) => boolean) {
  const provider = withSupabaseFilterAdapter(
    fakeRestDataProvider({ tags, contacts }, false),
  );
  const original = provider.getList;
  const getList = vi.spyOn(provider, "getList");
  if (fail)
    getList.mockImplementation((resource, params) =>
      fail(params.pagination?.page ?? 1)
        ? Promise.reject(new Error("Unavailable"))
        : original(resource, params),
    );
  const update = vi.spyOn(provider, "update");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const screen = render(
    <CoreAdminContext
      dataProvider={provider}
      i18nProvider={testI18nProvider}
      queryClient={queryClient}
      store={memoryStore()}
    >
      {children}
    </CoreAdminContext>,
  );
  return { screen, provider, getList, update };
}

it("loads 25 unassigned tags at a time, searches the full collection, and resets pagination", async () => {
  const onSelect = vi.fn();
  const { screen, getList } = setup(
    <TagPicker excludedIds={[0, 1]} onSelect={onSelect} onCreate={vi.fn()} />,
  );
  await screen;
  await expect
    .element(page.getByRole("option", { name: "Tag 002", exact: true }))
    .toBeVisible();
  expect(page.getByRole("option").all()).toHaveLength(25);
  expect(getList).toHaveBeenCalledTimes(1);
  expect(getList).toHaveBeenLastCalledWith(
    "tags",
    expect.objectContaining({
      pagination: { page: 1, perPage: 25 },
      filter: { "id@not.in": "(0,1)" },
    }),
  );
  await page.getByRole("button", { name: "Load more" }).click();
  await expect.poll(() => page.getByRole("option").all().length).toBe(50);
  expect(getList).toHaveBeenLastCalledWith(
    "tags",
    expect.objectContaining({ pagination: { page: 2, perPage: 25 } }),
  );
  await page.getByRole("combobox").fill("tAg 204");
  await expect
    .element(page.getByRole("option", { name: "Tag 204", exact: true }))
    .toBeVisible();
  expect(page.getByRole("option").all()).toHaveLength(1);
  expect(getList).toHaveBeenLastCalledWith(
    "tags",
    expect.objectContaining({
      pagination: { page: 1, perPage: 25 },
      filter: { "id@not.in": "(0,1)", "name@imatch": "tAg 204" },
    }),
  );
  await expect
    .element(page.getByRole("button", { name: "Load more" }))
    .not.toBeInTheDocument();
  await userEvent.keyboard("{ArrowDown}{Enter}");
  expect(onSelect).toHaveBeenCalledWith(tags[204]);
  await page.getByRole("combobox").fill("no such tag");
  await expect.element(page.getByText("No matching tags")).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Create new tag" }))
    .toBeVisible();
  await page.getByRole("combobox").fill("tag 20");
  await expect.poll(() => page.getByRole("option").all().length).toBe(5);
  await expect
    .element(page.getByRole("option", { name: "Tag 200", exact: true }))
    .toBeVisible();
});

it.each([1, 2])(
  "recovers from a failed request for page %s",
  async (failedPage) => {
    let fail = true;
    const { screen } = setup(
      <TagPicker onSelect={vi.fn()} onCreate={vi.fn()} />,
      (page) => fail && page === failedPage,
    );
    await screen;
    if (failedPage === 2) {
      await page.getByRole("button", { name: "Load more" }).click();
    }
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Could not load tags");
    if (failedPage === 2)
      expect(page.getByRole("option").all()).toHaveLength(25);
    fail = false;
    await page.getByRole("button", { name: "Retry" }).click();
    await expect
      .poll(() => page.getByRole("option").all().length)
      .toBe(failedPage * 25);
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  },
);

it("keeps Add tag available on a contact with no assigned tags", async () => {
  const { screen, update } = setup(
    <RecordContextProvider value={buildContact()}>
      <TagsListEdit />
    </RecordContextProvider>,
  );
  await screen;
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect.element(page.getByRole("combobox")).toHaveFocus();
  await page.getByRole("combobox").fill("204");
  await page.getByRole("option", { name: "Tag 204", exact: true }).click();
  await expect.poll(() => update.mock.calls.length).toBe(1);
  expect(update).toHaveBeenCalledWith(
    "contacts",
    expect.objectContaining({ id: 1, data: { tags: [204] } }),
  );
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect.element(page.getByRole("combobox")).toHaveValue("");
  await userEvent.keyboard("{Escape}");
  await expect
    .element(page.getByRole("button", { name: "Add tag" }))
    .toHaveFocus();
});

it("creates, assigns, and unlinks a tag through the contact picker", async () => {
  const { screen, provider } = setup(
    <ResourceContextProvider value="contacts">
      <ShowBase id={2}>
        <TagsListEdit />
      </ShowBase>
    </ResourceContextProvider>,
  );
  await screen;
  await page.getByRole("button", { name: "Add tag" }).click();
  await page.getByRole("combobox").fill("New customer");
  await expect.element(page.getByText("No matching tags")).toBeVisible();
  await page.getByRole("button", { name: "Create new tag" }).click();
  await page.getByRole("textbox", { name: "Tag name" }).fill("New customer");
  await page.getByRole("button", { name: "Save" }).click();
  await expect
    .element(page.getByText("New customer", { exact: true }))
    .toBeVisible();
  const { data: contact } = await provider.getOne("contacts", { id: 2 });
  expect(contact.tags).toHaveLength(2);
  await page
    .getByText("New customer", { exact: true })
    .getByRole("button")
    .click();
  await expect
    .poll(async () => (await provider.getOne("contacts", { id: 2 })).data.tags)
    .toEqual([0]);
});

function BulkSelection() {
  const list = useList({ data: contacts, resource: "contacts" });
  return (
    <ListContextProvider value={{ ...list, selectedIds: [1, 2] }}>
      <BulkTagButton />
    </ListContextProvider>
  );
}

it("selects bulk tags across pages and searches, then applies each contact once without duplicates", async () => {
  const { screen, provider, getList, update } = setup(<BulkSelection />);
  await screen;
  expect(getList).not.toHaveBeenCalled();
  await page.getByRole("button", { name: "Tag", exact: true }).click();
  await expect
    .element(page.getByRole("button", { name: "Apply tags (0)" }))
    .toBeDisabled();
  await page.getByRole("checkbox", { name: "Tag 001", exact: true }).click();
  await page.getByRole("button", { name: "Load more" }).click();
  await page.getByRole("checkbox", { name: "Tag 030", exact: true }).click();
  await page.getByRole("searchbox").fill("204");
  await page.getByRole("checkbox", { name: "Tag 204", exact: true }).click();
  await expect
    .element(page.getByRole("checkbox", { name: "Tag 204", exact: true }))
    .toBeChecked();
  await page
    .getByRole("button", { name: "Remove Tag 030 from selection" })
    .click();
  await page.getByRole("searchbox").fill("Tag 001");
  await expect
    .element(page.getByRole("checkbox", { name: "Tag 001", exact: true }))
    .toBeChecked();
  expect(update).not.toHaveBeenCalled();
  await page.getByRole("button", { name: "Apply tags (2)" }).click();
  await expect
    .poll(async () => (await provider.getOne("contacts", { id: 2 })).data.tags)
    .toEqual([0, 1, 204]);
  expect((await provider.getOne("contacts", { id: 1 })).data.tags).toEqual([
    0, 204, 1,
  ]);
  expect(update).toHaveBeenCalledTimes(2);
});

it("can toggle bulk tags with the keyboard and cancel without updating contacts", async () => {
  const { screen, update } = setup(<BulkSelection />);
  await screen;
  await page.getByRole("button", { name: "Tag", exact: true }).click();
  await page.getByRole("searchbox").fill("204");
  await expect
    .element(page.getByRole("checkbox", { name: "Tag 204", exact: true }))
    .toBeVisible();
  await userEvent.keyboard("{Tab} ");
  await expect
    .element(page.getByRole("checkbox", { name: "Tag 204", exact: true }))
    .toBeChecked();
  await userEvent.keyboard(" ");
  await expect
    .element(page.getByRole("button", { name: "Apply tags (0)" }))
    .toBeDisabled();
  await page.getByRole("checkbox", { name: "Tag 204", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(update).not.toHaveBeenCalled();
  await page.getByRole("button", { name: "Tag", exact: true }).click();
  await expect
    .element(page.getByRole("button", { name: "Apply tags (0)" }))
    .toBeDisabled();
});

it("adds a newly created tag to the pending bulk selection before applying", async () => {
  const { screen, provider, update } = setup(<BulkSelection />);
  await screen;
  await page.getByRole("button", { name: "Tag", exact: true }).click();
  await page.getByRole("checkbox", { name: "Tag 001", exact: true }).click();
  await page.getByRole("button", { name: "Create new tag" }).click();
  await page.getByRole("textbox", { name: "Tag name" }).fill("New customer");
  await page.getByRole("button", { name: "Save" }).click();
  await expect
    .element(
      page.getByRole("button", { name: "Remove New customer from selection" }),
    )
    .toBeVisible();
  expect(update).not.toHaveBeenCalled();
  await page.getByRole("button", { name: "Apply tags (2)" }).click();
  await expect
    .poll(async () => (await provider.getOne("contacts", { id: 2 })).data.tags)
    .toEqual([0, 1, 205]);
  expect((await provider.getOne("contacts", { id: 1 })).data.tags).toEqual([
    0, 204, 1, 205,
  ]);
});

it("can browse every page and stops offering Load more at the end", async () => {
  const { screen, getList } = setup(
    <TagPicker onSelect={vi.fn()} onCreate={vi.fn()} />,
  );
  await screen;
  await expect.poll(() => page.getByRole("option").all().length).toBe(25);
  for (let count = 50; count <= 225; count += 25) {
    await page.getByRole("button", { name: "Load more" }).click();
    await expect
      .poll(() => page.getByRole("option").all().length)
      .toBe(Math.min(count, 205));
  }
  expect(getList).toHaveBeenCalledTimes(9);
  await expect
    .element(page.getByRole("button", { name: "Load more" }))
    .not.toBeInTheDocument();
  await page.getByRole("combobox").fill("Tag 204");
  await expect.poll(() => page.getByRole("option").all().length).toBe(1);
  await page.getByRole("combobox").fill("");
  await expect.poll(() => page.getByRole("option").all().length).toBe(25);
});
