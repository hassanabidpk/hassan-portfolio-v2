import data from '../data/talks.json';

export interface Talk {
  title: string;
  date: string;
  attendees: number;
  location: string | null;
  summary: string;
  tags: string[];
  image: string | null;
}

export const talks: Talk[] = [...(data.talks as Talk[])].sort(
  (a, b) => +new Date(b.date) - +new Date(a.date)
);

export const totalTalks = talks.length;
export const totalAttendees = talks.reduce((n, t) => n + t.attendees, 0);
