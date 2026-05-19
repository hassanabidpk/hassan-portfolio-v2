import talksData from '../data/talks.json';
import mentoringData from '../data/mentoring.json';

export interface Talk {
  title: string;
  date: string;
  attendees: number;
  location: string | null;
  summary: string;
  tags: string[];
  image: string | null;
  post?: string;
}

export interface MentoringItem {
  title: string;
  date: string;
  location: string | null;
  summary: string;
  tags: string[];
  post: string | null;
}

const byDateDesc = (a: { date: string }, b: { date: string }) =>
  +new Date(b.date) - +new Date(a.date);

export const talks: Talk[] = [...(talksData.talks as Talk[])].sort(byDateDesc);

export const mentoring: MentoringItem[] = [
  ...(mentoringData.items as MentoringItem[]),
].sort(byDateDesc);

export const totalTalks = talks.length;
export const totalAttendees = talks.reduce((n, t) => n + t.attendees, 0);
