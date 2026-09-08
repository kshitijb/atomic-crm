import { useRecordContext, useTranslate } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";

import type { Contact } from "../types";

const formatMonth = (value?: string | null) => {
  if (!value) return null;
  const [year, month] = value.slice(0, 7).split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
};

export const ContactCompanies = () => {
  const record = useRecordContext<Contact>();
  const translate = useTranslate();

  if (!record?.company_affiliations?.length) return null;

  return (
    <div className="mt-4 border-t pt-3">
      <h6 className="mb-2 text-sm font-medium">
        {translate("resources.contacts.fields.company_affiliations")}
      </h6>
      <div className="flex flex-col gap-1 text-sm">
        {record.company_affiliations.map((affiliation) => {
          const start = formatMonth(affiliation.start_date);
          const end = formatMonth(affiliation.end_date);
          const dates =
            start || end
              ? ` (${start ?? ""}${start && end ? " – " : ""}${end ?? "Present"})`
              : "";

          return (
            <div key={affiliation.id ?? `${affiliation.company_id}-${start}`}>
              <ReferenceField
                record={affiliation}
                source="company_id"
                reference="companies"
                link="show"
              >
                <TextField source="name" />
              </ReferenceField>
              <span className="text-muted-foreground">{dates}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
