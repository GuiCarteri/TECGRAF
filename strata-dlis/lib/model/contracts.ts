import { z } from "zod";
const label = z.string().trim().min(1).max(400);
export const wellInput = z
  .object({
    name: label,
    field: label.nullable().optional(),
    company: label.nullable().optional(),
    identifier: label.nullable().optional(),
  })
  .strict();
export const wellLinkInput = z
  .object({ wellId: z.string().min(1).max(200) })
  .strict();
export const reportInput = z
  .object({
    title: label,
    fileId: z.string().min(1).max(200).optional(),
    analysisId: z.string().min(1).max(200).optional(),
    content: z
      .object({
        summary: z.string().max(10000),
        sections: z
          .array(
            z.object({ heading: label, text: z.string().max(20000) }).strict(),
          )
          .max(30),
      })
      .strict(),
  })
  .strict()
  .refine((value) => value.fileId || value.analysisId);
export type WellInput = z.infer<typeof wellInput>;
export type ReportInput = z.infer<typeof reportInput>;
