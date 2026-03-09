export type CronJobRow = {
  id: string;
  name: string | null;
  schedule: string;
  sessionKey: string;
  message: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  createdAt: string;
  updatedAt: string;
};
