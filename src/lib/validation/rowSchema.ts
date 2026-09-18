import { z } from 'zod';
import { ScrapeStatus } from '../scraping/scrapeProfile';

export const StudentInputSchema = z.object({
  rollNumber: z.string().min(1, 'Roll Number is required').max(50, 'Max 50 characters').trim(),
  name: z.string().min(1, 'Name is required').max(200, 'Max 200 characters').trim(),
  branch: z.string().max(100, 'Max 100 characters').trim().optional(),
  semester: z.string().max(50, 'Max 50 characters').trim().optional(),
  section: z.string().max(50, 'Max 50 characters').trim().optional(),
  mentor: z.string().min(1, 'Mentor is required').max(200, 'Max 200 characters').trim(),
  url: z.string().url('Invalid URL').max(500).trim(),
});

export type StudentInput = z.infer<typeof StudentInputSchema>;

export interface StudentRow extends StudentInput {
  id: string; // Internal UUID for row tracking
  status: ScrapeStatus;
  solved_today: number | null;
  total_solved: number | null;
  easy_solved: number | null;
  medium_solved: number | null;
  hard_solved: number | null;
  global_rank: number | null;
  badges: number | null;
  validationError?: string; // Set if row fails initial client-side validation
}
