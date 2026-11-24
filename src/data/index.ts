import { WEEK1_LESSONS } from './week1';
import { WEEK2_LESSONS } from './week2';
import { WEEK3_LESSONS } from './week3';
import { WEEK4_LESSONS } from './week4';
import { ELECTIVE_LESSONS } from './electives';
import { WEEKLY_TESTS, PLACEMENT_QUESTIONS } from './assessments';
import type { Lesson } from '../types/curriculum';

export const CORE_LESSONS: Lesson[] = [
  ...WEEK1_LESSONS,
  ...WEEK2_LESSONS,
  ...WEEK3_LESSONS,
  ...WEEK4_LESSONS,
];

export const ALL_LESSONS: Lesson[] = [...CORE_LESSONS, ...ELECTIVE_LESSONS];

export { ELECTIVE_LESSONS, WEEKLY_TESTS, PLACEMENT_QUESTIONS };
