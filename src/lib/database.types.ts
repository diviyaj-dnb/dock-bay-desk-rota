export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
export type DeskType = 'regular' | 'design' | 'no-screen';
export type BookingStatus = 'booked' | 'sofa_surf' | 'wfh';

export interface Database {
  public: {
    Tables: {
      team_members: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          is_designer: boolean;
          is_dog: boolean;
          archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          is_designer?: boolean;
          is_dog?: boolean;
          archived?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          is_designer?: boolean;
          is_dog?: boolean;
          archived?: boolean;
          created_at?: string;
        };
      };
      desks: {
        Row: {
          id: number;
          number: number;
          type: DeskType;
          table_name: 'left' | 'middle' | 'right';
          row: number;
          col: 'left' | 'right';
        };
        Insert: {
          id: number;
          number: number;
          type: DeskType;
          table_name: 'left' | 'middle' | 'right';
          row: number;
          col: 'left' | 'right';
        };
        Update: {
          id?: number;
          number?: number;
          type?: DeskType;
          table_name?: 'left' | 'middle' | 'right';
          row?: number;
          col?: 'left' | 'right';
        };
      };
      bookings: {
        Row: {
          id: string;
          member_id: string;
          week_id: string;
          day: DayOfWeek;
          desk_id: number | null;
          status: BookingStatus;
          booked_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          week_id: string;
          day: DayOfWeek;
          desk_id?: number | null;
          status: BookingStatus;
          booked_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          week_id?: string;
          day?: DayOfWeek;
          desk_id?: number | null;
          status?: BookingStatus;
          booked_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
