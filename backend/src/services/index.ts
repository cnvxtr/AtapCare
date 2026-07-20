/**
 * Services Index — Central export untuk semua backend services.
 * 
 * Import dari sini untuk akses semua services:
 *   import { login, getTickets, getInventory } from "@/services";
 */

// Auth
export {
  login,
  quickLogin,
  logout,
  getSession,
  hasRole,
  getDemoAccounts,
} from "./auth";
export type { Session } from "./auth";

// Tickets
export {
  getTickets,
  getTicketByCode,
  filterTickets,
  getTicketStats,
  createTicket,
  getTechnicians,
  getLocations,
  getAllLocations,
} from "./tickets";
export type { Ticket, Priority, TicketStatus } from "./tickets";
export {
  statusColors,
  priorityColors,
  kpiData,
  workloadData,
  trendData,
} from "./tickets";

// Inventory
export {
  getInventory,
  getInventoryItem,
  getInventoryBySku,
  filterInventory,
  getInventoryStats,
  getInventoryCategories,
} from "./inventory";
export type { InventoryItem } from "./inventory";
