export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

export type DeskType = 'regular' | 'design' | 'no-screen';

export interface Desk {
  id: number;
  number: number;
  type: DeskType;
  table: 'left' | 'middle' | 'right';
  row: number; // 1 to 6 (from bottom to top)
  col: 'left' | 'right';
}

export interface TeamMember {
  id: string;
  name: string;
  email?: string | null;
  isDog?: boolean;
  isDesigner?: boolean;
  isAdmin?: boolean;
}

export interface Booking {
  memberId: string;
  weekId: string; // ISO date string for Monday of the week (YYYY-MM-DD)
  day: DayOfWeek;
  deskId: number | null; // null if sofa-surfing or WFH
  status: 'booked' | 'sofa_surf' | 'wfh';
}
