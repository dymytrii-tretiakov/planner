import { PlannerApp } from "./core/PlannerApp";
import "./style.css";

const root = document.getElementById("app");
if (!root) throw new Error("App root not found");

// Bootstrap the planner app
new PlannerApp(root);
