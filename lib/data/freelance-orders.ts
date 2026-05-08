import { cache } from "react";
import { db } from "@/lib/db";

export const getFreelanceOrdersByWorkSource = cache(
  async (userId: string, workSourceId: string) => {
    return db.freelanceOrder.findMany({
      where: { userId, workSourceId },
      orderBy: [
        { performedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
    });
  },
);

export const getFreelanceOrderById = cache(
  async (userId: string, id: string) => {
    return db.freelanceOrder.findFirst({
      where: { id, userId },
    });
  },
);
