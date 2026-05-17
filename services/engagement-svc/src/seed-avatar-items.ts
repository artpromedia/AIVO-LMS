import { createDb } from "@aivo/db";
import { avatarItems, quests } from "@aivo/db";
import { sql } from "drizzle-orm";
import { QUEST_CHAPTER_CONTENT } from "./quest-content.js";

const db = createDb(process.env.DATABASE_URL!);

const AVATAR_ITEMS = [
  { name: "Explorer Hat", category: "accessories", rarity: "common", coinPrice: 50, gemPrice: 0, imageUrl: "/avatars/explorer-hat.png", isFree: false },
  { name: "Star Crown", category: "accessories", rarity: "rare", coinPrice: 200, gemPrice: 5, imageUrl: "/avatars/star-crown.png", isFree: false },
  { name: "Rainbow Headband", category: "accessories", rarity: "common", coinPrice: 75, gemPrice: 0, imageUrl: "/avatars/rainbow-headband.png", isFree: false },
  { name: "Wizard Hat", category: "accessories", rarity: "epic", coinPrice: 500, gemPrice: 15, imageUrl: "/avatars/wizard-hat.png", isFree: false },
  { name: "Dragon Crown", category: "accessories", rarity: "legendary", coinPrice: 1000, gemPrice: 30, imageUrl: "/avatars/dragon-crown.png", isFree: false },
  { name: "Flower Tiara", category: "accessories", rarity: "rare", coinPrice: 150, gemPrice: 3, imageUrl: "/avatars/flower-tiara.png", isFree: false },
  { name: "Pirate Bandana", category: "accessories", rarity: "common", coinPrice: 60, gemPrice: 0, imageUrl: "/avatars/pirate-bandana.png", isFree: false },
  { name: "Astronaut Helmet", category: "accessories", rarity: "epic", coinPrice: 400, gemPrice: 12, imageUrl: "/avatars/astronaut-helmet.png", isFree: false },
  { name: "Classic Blue", category: "outfits", rarity: "common", coinPrice: 0, gemPrice: 0, imageUrl: "/avatars/outfit-blue.png", isFree: true, isDefault: true },
  { name: "Sunset Orange", category: "outfits", rarity: "common", coinPrice: 80, gemPrice: 0, imageUrl: "/avatars/outfit-orange.png", isFree: false },
  { name: "Forest Green", category: "outfits", rarity: "common", coinPrice: 80, gemPrice: 0, imageUrl: "/avatars/outfit-green.png", isFree: false },
  { name: "Royal Purple", category: "outfits", rarity: "rare", coinPrice: 200, gemPrice: 5, imageUrl: "/avatars/outfit-purple.png", isFree: false },
  { name: "Galaxy Suit", category: "outfits", rarity: "epic", coinPrice: 500, gemPrice: 15, imageUrl: "/avatars/outfit-galaxy.png", isFree: false },
  { name: "Dragon Armor", category: "outfits", rarity: "legendary", coinPrice: 1200, gemPrice: 35, imageUrl: "/avatars/outfit-dragon.png", isFree: false },
  { name: "Lab Coat", category: "outfits", rarity: "rare", coinPrice: 180, gemPrice: 4, imageUrl: "/avatars/outfit-labcoat.png", isFree: false },
  { name: "Knight Armor", category: "outfits", rarity: "epic", coinPrice: 450, gemPrice: 12, imageUrl: "/avatars/outfit-knight.png", isFree: false },
  { name: "Spiky Red", category: "hair", rarity: "common", coinPrice: 40, gemPrice: 0, imageUrl: "/avatars/hair-red.png", isFree: false },
  { name: "Long Blonde", category: "hair", rarity: "common", coinPrice: 40, gemPrice: 0, imageUrl: "/avatars/hair-blonde.png", isFree: false },
  { name: "Curly Brown", category: "hair", rarity: "common", coinPrice: 0, gemPrice: 0, imageUrl: "/avatars/hair-brown.png", isFree: true, isDefault: true },
  { name: "Rainbow Streaks", category: "hair", rarity: "rare", coinPrice: 200, gemPrice: 5, imageUrl: "/avatars/hair-rainbow.png", isFree: false },
  { name: "Flame Hair", category: "hair", rarity: "epic", coinPrice: 400, gemPrice: 10, imageUrl: "/avatars/hair-flame.png", isFree: false },
  { name: "Crystal Hair", category: "hair", rarity: "legendary", coinPrice: 800, gemPrice: 25, imageUrl: "/avatars/hair-crystal.png", isFree: false },
  { name: "Space Buns", category: "hair", rarity: "rare", coinPrice: 150, gemPrice: 3, imageUrl: "/avatars/hair-spacebuns.png", isFree: false },
  { name: "Mohawk", category: "hair", rarity: "common", coinPrice: 60, gemPrice: 0, imageUrl: "/avatars/hair-mohawk.png", isFree: false },
  { name: "Sunny Meadow", category: "backgrounds", rarity: "common", coinPrice: 0, gemPrice: 0, imageUrl: "/avatars/bg-meadow.png", isFree: true, isDefault: true },
  { name: "Starry Night", category: "backgrounds", rarity: "common", coinPrice: 100, gemPrice: 0, imageUrl: "/avatars/bg-stars.png", isFree: false },
  { name: "Ocean Depths", category: "backgrounds", rarity: "rare", coinPrice: 250, gemPrice: 6, imageUrl: "/avatars/bg-ocean.png", isFree: false },
  { name: "Volcano Island", category: "backgrounds", rarity: "epic", coinPrice: 500, gemPrice: 15, imageUrl: "/avatars/bg-volcano.png", isFree: false },
  { name: "Crystal Cave", category: "backgrounds", rarity: "legendary", coinPrice: 1000, gemPrice: 30, imageUrl: "/avatars/bg-crystal.png", isFree: false },
  { name: "Rainbow Bridge", category: "backgrounds", rarity: "rare", coinPrice: 200, gemPrice: 5, imageUrl: "/avatars/bg-rainbow.png", isFree: false },
  { name: "Cloud Kingdom", category: "backgrounds", rarity: "epic", coinPrice: 400, gemPrice: 10, imageUrl: "/avatars/bg-clouds.png", isFree: false },
  { name: "Neon City", category: "backgrounds", rarity: "rare", coinPrice: 300, gemPrice: 7, imageUrl: "/avatars/bg-neon.png", isFree: false },
  { name: "Wave Hello", category: "emotes", rarity: "common", coinPrice: 0, gemPrice: 0, imageUrl: "/avatars/emote-wave.png", isFree: true, isDefault: true },
  { name: "Victory Dance", category: "emotes", rarity: "common", coinPrice: 100, gemPrice: 0, imageUrl: "/avatars/emote-victory.png", isFree: false },
  { name: "Mind Blown", category: "emotes", rarity: "rare", coinPrice: 200, gemPrice: 5, imageUrl: "/avatars/emote-mindblown.png", isFree: false },
  { name: "Fireworks", category: "emotes", rarity: "epic", coinPrice: 400, gemPrice: 10, imageUrl: "/avatars/emote-fireworks.png", isFree: false },
  { name: "Confetti Burst", category: "emotes", rarity: "rare", coinPrice: 180, gemPrice: 4, imageUrl: "/avatars/emote-confetti.png", isFree: false },
  { name: "Lightning Bolt", category: "emotes", rarity: "legendary", coinPrice: 800, gemPrice: 20, imageUrl: "/avatars/emote-lightning.png", isFree: false },
  { name: "Rocket Launch", category: "emotes", rarity: "epic", coinPrice: 350, gemPrice: 8, imageUrl: "/avatars/emote-rocket.png", isFree: false },
  { name: "Star Explosion", category: "emotes", rarity: "rare", coinPrice: 250, gemPrice: 6, imageUrl: "/avatars/emote-star.png", isFree: false },
  { name: "Peach", category: "skin_tones", rarity: "common", coinPrice: 0, gemPrice: 0, imageUrl: "/avatars/skin-peach.png", isFree: true, isDefault: true },
  { name: "Tan", category: "skin_tones", rarity: "common", coinPrice: 0, gemPrice: 0, imageUrl: "/avatars/skin-tan.png", isFree: true },
  { name: "Brown", category: "skin_tones", rarity: "common", coinPrice: 0, gemPrice: 0, imageUrl: "/avatars/skin-brown.png", isFree: true },
  { name: "Dark Brown", category: "skin_tones", rarity: "common", coinPrice: 0, gemPrice: 0, imageUrl: "/avatars/skin-darkbrown.png", isFree: true },
  { name: "Olive", category: "skin_tones", rarity: "common", coinPrice: 0, gemPrice: 0, imageUrl: "/avatars/skin-olive.png", isFree: true },
  { name: "Light", category: "skin_tones", rarity: "common", coinPrice: 0, gemPrice: 0, imageUrl: "/avatars/skin-light.png", isFree: true },
  { name: "Robot Blue", category: "skin_tones", rarity: "epic", coinPrice: 300, gemPrice: 8, imageUrl: "/avatars/skin-robot.png", isFree: false },
  { name: "Alien Green", category: "skin_tones", rarity: "epic", coinPrice: 300, gemPrice: 8, imageUrl: "/avatars/skin-alien.png", isFree: false },
  { name: "Galaxy Purple", category: "skin_tones", rarity: "legendary", coinPrice: 600, gemPrice: 18, imageUrl: "/avatars/skin-galaxy.png", isFree: false },
  { name: "Sparkle Gold", category: "skin_tones", rarity: "legendary", coinPrice: 700, gemPrice: 20, imageUrl: "/avatars/skin-gold.png", isFree: false },
];

async function seed() {
  console.log("Seeding avatar items...");
  for (const item of AVATAR_ITEMS) {
    await db.insert(avatarItems).values(item).onConflictDoNothing();
  }
  console.log(`Seeded ${AVATAR_ITEMS.length} avatar items.`);

  console.log("Seeding quest chapters...");
  let questCount = 0;
  for (const chapter of QUEST_CHAPTER_CONTENT) {
    await db
      .insert(quests)
      .values({
        worldKey: chapter.worldKey,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        description: chapter.description,
        narrativeIntro: chapter.narrativeIntro,
        narrativeOutro: chapter.narrativeOutro,
        subject: chapter.subject,
        xpReward: chapter.xpReward,
        coinReward: chapter.coinReward,
        bossAssessment: chapter.bossAssessment,
      })
      .onConflictDoUpdate({
        target: [quests.worldKey, quests.chapterNumber],
        set: {
          title: chapter.title,
          description: chapter.description,
          narrativeIntro: chapter.narrativeIntro,
          narrativeOutro: chapter.narrativeOutro,
          subject: chapter.subject,
          xpReward: chapter.xpReward,
          coinReward: chapter.coinReward,
          bossAssessment: chapter.bossAssessment,
        },
      });
    questCount++;
  }
  console.log(`Seeded ${questCount} quest chapters.`);

  // Sanity check: every core world has 5 chapters after seeding.
  const counts = await db.execute(
    sql`SELECT world_key, COUNT(*)::int AS c FROM quests GROUP BY world_key ORDER BY world_key`,
  );
  console.log("Quest chapter counts:", (counts as any).rows ?? counts);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
