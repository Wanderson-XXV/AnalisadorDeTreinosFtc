// React Router v7 - Definição de rotas
// Adapte conforme a estrutura do seu projeto

import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Página principal - Timer
  index("routes/home.tsx"),
  
  // Dashboard - Estatísticas e gráficos
  route("dashboard", "routes/dashboard.tsx"),
  
  // Histórico - Lista de rounds anteriores
  route("history", "routes/history.tsx"),
  
  // Campeonatos - Em breve
  route("championships", "routes/championships.tsx"),
] satisfies RouteConfig;
