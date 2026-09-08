import { supabaseDataProvider } from "ra-supabase-core";
import fakeRestDataProvider from "ra-data-fakerest";
import { withSupabaseFilterAdapter } from "../providers/fakerest/internal/supabaseAdapter";

it("sends tag pagination, search and exclusions to Supabase", async () => {
  const httpClient = vi.fn().mockResolvedValue({
    json: [],
    headers: new Headers({ "content-range": "25-49/205" }),
  });
  const provider = supabaseDataProvider({
    instanceUrl: "https://example.supabase.co",
    apiKey: "test-key",
    httpClient,
  });
  const result = await provider.getList("tags", {
    pagination: { page: 2, perPage: 25 },
    sort: { field: "name", order: "ASC" },
    filter: { "name@imatch": "Customer VIP", "id@not.in": "(1,2)" },
  });
  const url = new URL(httpClient.mock.calls[0][0]);
  expect(url.pathname).toBe("/rest/v1/tags");
  expect(url.searchParams.getAll("name")).toEqual(["imatch.Customer VIP"]);
  expect(url.searchParams.get("id")).toBe("not.in.(1,2)");
  expect(url.searchParams.get("order")).toBe("name.asc");
  expect(url.searchParams.get("offset")).toBe("25");
  expect(url.searchParams.get("limit")).toBe("25");
  expect(result.total).toBe(205);
});

it("searches tag names case-insensitively and excludes assigned IDs before pagination in FakeRest", async () => {
  const provider = withSupabaseFilterAdapter(
    fakeRestDataProvider(
      {
        tags: [
          { id: 1, name: "VIP customer" },
          { id: 2, name: "Customer VIP" },
          { id: 3, name: "Customer" },
          { id: 4, name: "Unrelated", color: "Customer VIP" },
          { id: 5, name: "C++ [VIP]" },
        ],
      },
      false,
    ),
  );
  const result = await provider.getList("tags", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "name", order: "ASC" },
    filter: { "name@imatch": "customer vip", "id@not.in": "(1)" },
  });
  expect(result.data.map((tag) => tag.id)).toEqual([2]);
  expect(result.total).toBe(1);
  const literal = await provider.getList("tags", {
    pagination: { page: 1, perPage: 25 },
    sort: { field: "name", order: "ASC" },
    filter: { "name@imatch": String.raw`C\+\+ \[VIP\]` },
  });
  expect(literal.data.map((tag) => tag.id)).toEqual([5]);
});
