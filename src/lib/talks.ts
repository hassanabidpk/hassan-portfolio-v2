import talksData from '../data/talks.json';
import workshopsData from '../data/workshops.json';
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

export interface Activity {
  title: string;
  date: string;
  attendees?: number;
  location: string | null;
  summary: string;
  tags: string[];
  image?: string | null;
  post?: string;
}

const byDateDesc = (a: { date: string }, b: { date: string }) =>
  +new Date(b.date) - +new Date(a.date);

export const talks: Talk[] = [...(talksData.talks as Talk[])].sort(byDateDesc);
export const workshops: Activity[] = [
  ...(workshopsData.items as Activity[]),
].sort(byDateDesc);
export const mentoring: Activity[] = [
  ...(mentoringData.items as Activity[]),
].sort(byDateDesc);

const sumAttendees = (xs: { attendees?: number }[]) =>
  xs.reduce((n, x) => n + (x.attendees ?? 0), 0);

export const totalTalks = talks.length;
export const totalAttendees = talks.reduce((n, t) => n + t.attendees, 0);
export const totalWorkshops = workshops.length;
export const workshopAttendees = sumAttendees(workshops);
export const totalMentoring = mentoring.length;
export const mentoringAttendees = sumAttendees(mentoring);
