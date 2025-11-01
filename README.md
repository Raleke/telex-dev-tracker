Telex Dev Tracker

A development tracking assistant bot for Telex, built with Node.js, TypeScript, and Mastra AI agents. It helps manage development tasks, generate daily summaries, detect issues, and integrate with Telex workflows via Agent-to-Agent (A2A) communication.

Features

- Task Management: Add, mark as done/in-progress, delete tasks, and list current tasks.
- Daily Summaries: Automatically generate and send daily progress summaries.
- Issue Detection: Automatically detect and log potential issues from messages.
- A2A Integration: Seamless integration with Telex workflows through Agent-to-Agent endpoints.
- Webhook Support: Handle incoming webhooks from Telex for compatibility.
- Admin Endpoints: Administrative access for summaries and manual operations.
- Progress Charts: Visualize task progress over time.
- External AI Integration: Optional forwarding to external Mastra agents for advanced processing.

Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd telex-dev-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables by creating a `.env` file:
   ```env
   PORT=8080
   DEFAULT_CHANNEL_ID=your_default_channel_id
   SYSTEM_PROMPT=Your system prompt for external Mastra agent (optional)
   # Add other required environment variables as needed
   ```

4. Build the project:
   ```bash
   npm run build
   ```

Usage
Running the Application

- Development mode (with TypeScript compilation on-the-fly):
  ```bash
  npm run dev
  ```

- Production mode (using compiled JavaScript):
  ```bash
  npm start
  ```

The server will start on the port specified in your `.env` file (default: 8080).

API Endpoints

Health Check
- `GET /` - Returns health status of the service.

Agent-to-Agent (A2A)
- `POST /a2a/agent/devTrackerAgent` - Main endpoint for Telex A2A communication.
  - Body: `{ "input": "command text", "metadata": { "channelId": "...", "userId": "..." } }`
  - Processes natural language commands for task management.

Webhook
- `POST /webhook/telex` - Webhook endpoint for Telex compatibility.
  - Handles incoming messages in Telex webhook format.

Admin Endpoints
- `GET /admin/summaries` - Retrieve recent summaries (last 20).
- `POST /admin/summary/run` - Manually trigger daily summary generation.

Progress
- `GET /progress?channelId=<id>&userId=<id>` - Get progress chart data for tasks.

Commands

Interact with the bot using natural language commands:

- Add Task: "add task Fix API bug" or "add task Implement new feature"
- Mark Task: "mark 3 as done" or "mark Fix API bug as in-progress"
- Delete Task: "delete 3" or "delete Fix API bug"
- Delete Completed Tasks: "delete all completed tasks" or "delete all done"
- List Tasks: "show tasks" or "list tasks"
- Show Summary: "summary" or "daily summary"
- Help: Any unrecognized input will return help text with available commands.

Configuration

- Environment Variables:
  - `PORT`: Server port (default: 8080)
  - `DEFAULT_CHANNEL_ID`: Default channel ID for operations
  - `SYSTEM_PROMPT`: System prompt for external Mastra agent integration (optional)

- Database: Uses SQLite (better-sqlite3) for data storage. Database file is created automatically in the `data/` directory.

- Scheduling: Daily summaries are scheduled automatically using cron jobs.


Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes and commit: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Submit a pull request.


