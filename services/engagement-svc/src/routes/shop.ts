import { FastifyInstance } from "fastify";
import { eq, sql, and } from "drizzle-orm";
import {
  avatarItems,
  avatarInventory,
  virtualCurrency,
  currencyTransactions,
  xpEvents,
} from "@aivo/db";
import { authenticateRequest, requireSelfOrRole } from "../auth.js";
import {
  getShopItemsSchema,
  getShopInventoryByLearnerIdSchema,
  shopPurchaseSchema,
  shopEquipSchema,
} from "./schemas.js";

function calculateLevel(totalXp: number): number {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= level * level * 100) {
    remaining -= level * level * 100;
    level++;
  }
  return level;
}

export function registerShopRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof import("@aivo/db").createDb>,
) {
  app.get("/api/engagement/shop/items", { schema: getShopItemsSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const items = await db.select().from(avatarItems);
    return items;
  });

  app.get(
    "/api/engagement/shop/inventory/:learnerId",
    { schema: getShopInventoryByLearnerIdSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId } = request.params as { learnerId: string };
      if (!requireSelfOrRole(claims, learnerId, "PARENT", "PLATFORM_ADMIN")) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const inventory = await db
        .select()
        .from(avatarInventory)
        .where(eq(avatarInventory.learnerId, learnerId));

      return inventory;
    },
  );

  app.post(
    "/api/engagement/shop/purchase",
    { schema: shopPurchaseSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId, itemId, currencyType } = request.body as {
        learnerId: string;
        itemId: string;
        currencyType: "coins" | "gems";
      };

      if (!requireSelfOrRole(claims, learnerId, "PARENT", "PLATFORM_ADMIN")) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const [item] = await db.select().from(avatarItems).where(eq(avatarItems.id, itemId));
      if (!item) return reply.status(404).send({ error: "Item not found" });

      if (item.levelRequired && item.levelRequired > 1) {
        const [xpResult] = await db
          .select({ total: sql<number>`COALESCE(SUM(${xpEvents.xpAmount}), 0)` })
          .from(xpEvents)
          .where(eq(xpEvents.learnerId, learnerId));
        const learnerLevel = calculateLevel(Number(xpResult.total));
        if (learnerLevel < item.levelRequired) {
          return reply.status(400).send({
            error: `Requires level ${item.levelRequired}. You are level ${learnerLevel}.`,
          });
        }
      }

      const alreadyOwned = await db
        .select()
        .from(avatarInventory)
        .where(and(eq(avatarInventory.learnerId, learnerId), eq(avatarInventory.itemId, itemId)));

      if (alreadyOwned.length > 0) {
        return reply.status(400).send({ error: "Item already owned" });
      }

      const price = currencyType === "gems" ? item.gemPrice || 0 : item.coinPrice || 0;
      if (price <= 0 && !item.isFree) {
        return reply.status(400).send({ error: "Item not available for this currency" });
      }

      if (!item.isFree && price > 0) {
        const [wallet] = await db
          .select()
          .from(virtualCurrency)
          .where(eq(virtualCurrency.learnerId, learnerId));

        if (!wallet) return reply.status(400).send({ error: "No wallet found" });

        const balance = currencyType === "gems" ? wallet.gems || 0 : wallet.coins || 0;
        if (balance < price) {
          return reply.status(400).send({ error: "Insufficient funds" });
        }

        const updateField =
          currencyType === "gems"
            ? { gems: sql`${virtualCurrency.gems} - ${price}` }
            : { coins: sql`${virtualCurrency.coins} - ${price}` };

        await db
          .update(virtualCurrency)
          .set({ ...updateField, updatedAt: new Date() })
          .where(eq(virtualCurrency.learnerId, learnerId));

        await db.insert(currencyTransactions).values({
          learnerId,
          currencyType,
          amount: -price,
          reason: `purchase_${item.category}_${item.name}`,
          referenceId: itemId,
        });
      }

      const [inv] = await db.insert(avatarInventory).values({ learnerId, itemId }).returning();

      return { purchased: true, item, inventory: inv };
    },
  );

  app.post("/api/engagement/shop/equip", { schema: shopEquipSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId, itemId, equipped } = request.body as {
      learnerId: string;
      itemId: string;
      equipped: boolean;
    };

    if (!requireSelfOrRole(claims, learnerId, "PARENT", "PLATFORM_ADMIN")) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const [inv] = await db
      .select()
      .from(avatarInventory)
      .where(and(eq(avatarInventory.learnerId, learnerId), eq(avatarInventory.itemId, itemId)));

    if (!inv) return reply.status(404).send({ error: "Item not in inventory" });

    const [item] = await db.select().from(avatarItems).where(eq(avatarItems.id, itemId));

    if (equipped && item) {
      await db
        .update(avatarInventory)
        .set({ equipped: false })
        .where(and(eq(avatarInventory.learnerId, learnerId), eq(avatarInventory.equipped, true)));
    }

    await db
      .update(avatarInventory)
      .set({ equipped })
      .where(and(eq(avatarInventory.learnerId, learnerId), eq(avatarInventory.itemId, itemId)));

    return { equipped };
  });
}
