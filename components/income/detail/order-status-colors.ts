import { FreelanceOrderStatus } from "@prisma/client";

export const STATUS_COLOR: Record<FreelanceOrderStatus, string> = {
  PLANNED: "var(--info)",
  ACTIVE: "var(--accent)",
  AWAITING_PAYMENT: "var(--warn)",
  COMPLETED: "var(--pos)",
  CANCELLED: "var(--muted)",
};

export const STATUS_ORDER: FreelanceOrderStatus[] = [
  FreelanceOrderStatus.PLANNED,
  FreelanceOrderStatus.ACTIVE,
  FreelanceOrderStatus.AWAITING_PAYMENT,
  FreelanceOrderStatus.COMPLETED,
  FreelanceOrderStatus.CANCELLED,
];
