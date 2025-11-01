# Implement New Features for Telex Dev Tracker

## Tasks
- [ ] Update DB schema: Add channel_id and user_id to tasks table in src/db.ts
- [ ] Define Task type in src/types.ts with new fields
- [ ] Update AgentLogic in src/agent.ts: Modify functions to accept channelId and userId, add deleteTask function, update listTasks to filter by channel/user
- [ ] Enhance command parsing in src/index.ts: Improve regex and logic for natural language, e.g., detect "delete all completed tasks"
- [ ] Add progress chart endpoint in src/index.ts: New route /progress that returns aggregated task data
- [ ] Update generateDailySummary to be per channel if needed
- [ ] Test the changes: Run the app and verify endpoints
