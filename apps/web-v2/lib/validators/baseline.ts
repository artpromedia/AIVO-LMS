import { z } from "zod";

export const BaselineAnswerInput = z.object({
  questionId: z.string().min(1),
  response: z.string().max(2000),
  skipped: z.boolean().optional(),
});
export type BaselineAnswerInput = z.infer<typeof BaselineAnswerInput>;

export const BaselineCreateInput = z
  .object({
    subjectIds: z.array(z.string().min(1)).max(7).optional(),
  })
  .strict();
export type BaselineCreateInput = z.infer<typeof BaselineCreateInput>;
