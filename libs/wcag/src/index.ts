import checklist from './guidelines.json' assert { type: 'json' };


export type WCAGChecklist = typeof checklist;
export const wcagChecklist: WCAGChecklist = checklist;