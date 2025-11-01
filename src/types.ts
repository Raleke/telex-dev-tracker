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

export type Issue = {
  id: number;
  description: string;
  severity: string;
  channel_id?: string;
  status: string;
  detected_at: string;
};
