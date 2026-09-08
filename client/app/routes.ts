import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
  route("history", "routes/history.tsx"),
  route("teams", "routes/teams.tsx"),
  route("championship-management", "routes/championship-management.tsx"),
  route("championships", "routes/championships.tsx"),
  route("scout-management", "routes/scout-management.tsx"),
  route("users", "routes/users.tsx"),
  route("scouting/:id", "routes/scouting.tsx"),
  route("team/:teamNumber", "routes/team-profile.tsx"),
  route("analysis", "routes/analysis.tsx"),
  route("settings", "routes/settings.tsx"),
  route("match-analysis/:matchId", "routes/match-analysis.tsx"),
] satisfies RouteConfig;
