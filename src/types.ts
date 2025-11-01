export type Task = {
  id: number;
  title: string;
  status: string;
  labels?: string;
  channel_id?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
};
