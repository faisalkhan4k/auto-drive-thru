const fs = require("fs");

// Base components for procedural generation
const proteins = [
  {
    name: "Beef Patty",
    halal: true,
    kosher: true,
    allergens: [],
    type: "meat",
  },
  {
    name: "Crispy Chicken",
    halal: true,
    kosher: true,
    allergens: ["wheat", "soy"],
    type: "meat",
  },
  { name: "Bacon", halal: false, kosher: false, allergens: [], type: "pork" },
  {
    name: "Beyond Meat",
    halal: true,
    kosher: true,
    allergens: ["soy"],
    type: "vegan",
  },
  {
    name: "Grilled Fish",
    halal: true,
    kosher: true,
    allergens: ["fish"],
    type: "seafood",
  },
];

const styles = [
  "Classic",
  "Spicy",
  "BBQ",
  "Truffle",
  "Double",
  "Deluxe",
  "Smash",
  "Volcano",
  "Teriyaki",
  "Garlic",
];
const categories = ["Burger", "Wrap", "Bowl", "Salad", "Tacos"];

const generateCookingSteps = (protein, category) => {
  const steps = ["Sanitize workstation and verify dietary separation."];
  if (protein.type === "meat")
    steps.push(`Grill ${protein.name} to 165F internal temperature.`);
  if (protein.type === "pork")
    steps.push(`Fry ${protein.name} in designated non-halal oil vat.`);
  if (protein.type === "vegan")
    steps.push(`Cook ${protein.name} on designated plant-based flat top.`);

  steps.push(
    `Toast bun/wrap.`,
    `Assemble ${category} with fresh garnishes.`,
    `Quality check and package for window.`,
  );
  return steps;
};

const menu = [];
let idCounter = 1;

// 1. Generate 70 Main Courses procedurally
for (let i = 0; i < 70; i++) {
  const protein = proteins[Math.floor(Math.random() * proteins.length)];
  const style = styles[Math.floor(Math.random() * styles.length)];
  const category = categories[Math.floor(Math.random() * categories.length)];

  const hasCheese = Math.random() > 0.5;
  const isFried = Math.random() > 0.5;

  let isKosher = protein.kosher;
  // Rule: Meat and dairy cannot mix in Kosher
  if (hasCheese && protein.type === "meat") isKosher = false;

  const allergens = [...protein.allergens];
  if (hasCheese) allergens.push("dairy");
  if (category === "Burger" || category === "Wrap")
    allergens.push("wheat", "gluten");

  // Contact Free / Cross contamination logic
  let contactFree = "Dedicated prep area used.";
  if (isFried && protein.halal) {
    // Simulate a real-world kitchen warning
    contactFree =
      Math.random() > 0.7
        ? "WARNING: Fried in shared oil vat with non-halal items."
        : "Fried in dedicated Halal-only oil vat.";
  }

  menu.push({
    id: `ITEM_${idCounter++}`,
    name: `${style} ${protein.name} ${category}`,
    description: `A delicious ${style.toLowerCase()} ${category.toLowerCase()} featuring our signature ${protein.name.toLowerCase()}.`,
    category: "Mains",
    price: (Math.random() * (15 - 8) + 8).toFixed(2),
    nutrition: {
      calories: Math.floor(Math.random() * (900 - 400) + 400),
      protein_g: Math.floor(Math.random() * (50 - 15) + 15),
      carbs_g: Math.floor(Math.random() * (80 - 20) + 20),
      fat_g: Math.floor(Math.random() * (45 - 10) + 10),
    },
    dietary: {
      is_halal: protein.halal && !contactFree.includes("shared oil vat"),
      is_kosher: isKosher,
      is_gluten_free: !allergens.includes("gluten"),
      is_vegan: protein.type === "vegan" && !hasCheese,
    },
    allergens: [...new Set(allergens)], // Remove duplicates
    contact_free_status: contactFree,
    cooking_steps: generateCookingSteps(protein, category),
  });
}

// 2. Generate 15 Sides
const sides = [
  "Fries",
  "Onion Rings",
  "Mozzarella Sticks",
  "Side Salad",
  "Sweet Potato Waffle Fries",
];
for (let i = 0; i < 15; i++) {
  const side = sides[i % sides.length];
  menu.push({
    id: `ITEM_${idCounter++}`,
    name: `Large ${side}`,
    description: `Freshly prepared ${side.toLowerCase()}.`,
    category: "Sides",
    price: (Math.random() * (6 - 3) + 3).toFixed(2),
    nutrition: { calories: 350, protein_g: 4, carbs_g: 45, fat_g: 18 },
    dietary: {
      is_halal: true,
      is_kosher: true,
      is_gluten_free: side !== "Onion Rings",
      is_vegan: side !== "Mozzarella Sticks",
    },
    allergens: side === "Mozzarella Sticks" ? ["dairy", "wheat", "gluten"] : [],
    contact_free_status: "WARNING: May be fried in shared oil vat.",
    cooking_steps: [
      `Drop ${side} in fryer for 3 minutes.`,
      `Drain, salt, and bag.`,
    ],
  });
}

// 3. Generate 15 Drinks/Desserts
const drinks = [
  "Cola",
  "Vanilla Shake",
  "Strawberry Smoothie",
  "Iced Coffee",
  "Lemonade",
];
for (let i = 0; i < 15; i++) {
  const drink = drinks[i % drinks.length];
  const isDairy = drink.includes("Shake");
  menu.push({
    id: `ITEM_${idCounter++}`,
    name: drink,
    description: `Refreshing ${drink.toLowerCase()}.`,
    category: "Beverages & Desserts",
    price: (Math.random() * (5 - 2) + 2).toFixed(2),
    nutrition: {
      calories: isDairy ? 450 : 150,
      protein_g: isDairy ? 10 : 0,
      carbs_g: isDairy ? 60 : 40,
      fat_g: isDairy ? 15 : 0,
    },
    dietary: {
      is_halal: true,
      is_kosher: true,
      is_gluten_free: true,
      is_vegan: !isDairy,
    },
    allergens: isDairy ? ["dairy"] : [],
    contact_free_status: "Prepared in dedicated beverage station.",
    cooking_steps: [
      `Fill cup with base/ice.`,
      `Dispense ${drink}.`,
      `Cap and serve.`,
    ],
  });
}

// Write to JSON file
fs.writeFileSync("menu.json", JSON.stringify(menu, null, 2));
console.log(
  `✅ Successfully generated ${menu.length} menu items into menu.json!`,
);
