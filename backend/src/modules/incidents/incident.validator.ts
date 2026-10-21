// backend/src/modules/incidents/incident.validator.ts

import { z } from "zod";

/**
 * Validation schema for formal clinical incident submissions.
 * Enforces mandatory title, clinical description, severity level,
 * primary category, physical location, and target hospital department ID.
 */
export const incidentSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters"),

  description: z
    .string()
    .min(10, "Description must be at least 10 characters"),

  severity: z.enum([
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL",
  ]),

  category: z
    .string()
    .min(2, "Category is required"),

  location: z
    .string()
    .min(2, "Location is required"),

  departmentId: z.coerce.number()
});

/**
 * Validation schema for department incident lookup route parameters.
 * Validates that departmentId in URL param (/department/:departmentId) is a positive integer.
 */
export const departmentParamsSchema = z.object({
  departmentId: z
    .string()
    .regex(/^[1-9]\d*$/, "Department ID must be a positive integer.")
    .transform(Number),
});