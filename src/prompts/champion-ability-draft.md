You are an MCOC Ability Extraction Expert. Your task is to analyze a champion's detailed "full_abilities" JSON and generate a new JSON object containing two lists: "abilities" and "immunities".

**Objective:**
Create a JSON object with two keys: "abilities" and "immunities". Each key will contain a list of objects, where each object has a "name" and a "source".

**Input for each champion will be:**

1. Champion Name: [Champion's Name]
2. "full_abilities" JSON:
   ```json
   ["full_abilities" JSON for the champion]
   ```

**Output required is ONLY the new JSON object for that champion.**

**Key Formatting Rules & Syntax to Strictly Follow:**

1.  **Output Structure:** The output must be a single JSON object with two keys: `abilities` and `immunities`.

    ```json
    {
      "abilities": [
        {
          "name": "Ability Name",
          "source": "Source of the ability"
        }
      ],
      "immunities": [
        {
          "name": "Immunity Name",
          "source": "Source of the immunity"
        }
      ]
    }
    ```

2.  **Ability/Immunity Name (`name`):**

    - Use the exact, standardized name of the effect (e.g., "Shock", "Fury", "Power Gain", "Unstoppable", "Stun Immune").
    - For immunities, use the name of the effect they are immune to (e.g., "Bleed", "Poison", "Stun").

3.  **Source (`source`):**
    - This should be a concise description of how the ability or immunity is triggered or applied.
    - Use common MCOC terms like "SP1", "SP2", "SP3", "Heavy Attack", "Light Attacks", "Medium Attacks", "Signature Ability", "Always Active".
    - If an ability is part of the signature ability, start the source with "Dupe".
    - if an immunity has no condition and is just always active leave the source blank.
    - Include conditions, durations, stack limits, and cooldowns if they are important.

**Here are some examples of input "full_abilities" and the desired JSON output:**

--- EXAMPLE 1 ---
Champion Name: Beta Ray Bill
"full_abilities" JSON:

```json
{
  "signature": {
    "name": "CHAMPION OF KORBIN",
    "description": "The potency of personal bursts of damage is increased by 9.2 - 40%.\nReduce Call of Thunder’s Unstoppable cooldown by 2.08 - 10 seconds.\nWhile a personal Unstoppable Buff is active, damage taken is reduced by 20.81 - 100%. Does not reduce damage from Special Attack 3."
  },
  "abilities_breakdown": [
    {
      "type": "Always Active",
      "title": "General Passives & Immunities",
      "description": "Incoming Bleed and Poison effects suffer 50% reduced potency.\nBeta Ray Bill is Immune to Shock and Power Drain. When the Power Drain Immunity triggers, he gains a Power Gain Passive, granting 1 Bar of Power over 0.5 seconds. Cooldown: 14 seconds.\nWhen starting a fight against Tech Champions or when Immune to an effect, gain a Steady Buff for 20 seconds.\nThe Thor Relic increases the potency of personal Buffs by 25%."
    },
    {
      "type": "Heavy Attacks",
      "title": "Call of Thunder - While Charging a Heavy Attack",
      "description": "Gain an Unstoppable Buff. If struck while this Buff is active this effect goes on cooldown for 24 seconds.\nAll Buffs on Beta Ray Bill and all Shocks on the Opponent are paused.\nEvery 0.4 seconds gain a 20% Intensify Buff for 4 seconds. Max stacks: 5. Beta Ray Bill’s Heavy Attack can be charged for an extended duration.\nWhile above 2 Bars of Power: while Beta Ray Bill is below 2 Stacks of Intensify, the Opponent suffers a 1,007.1 Intimidate Passive. At max stacks, the Opponent suffers a 10% Infuriate Passive.\nActivating a Special Attack 2 while charging a Heavy Attack pauses all personal Buffs until Beta Ray Bill has landed or been struck by 4 Basic Hits per Intensify gained, up to a max of 20. Heavy Hits count as 2 hits. This effect does not trigger if it is already active.\nReleasing the Heavy Attack grants a Grit Buff for 15 seconds."
    },
    {
      "type": "Medium Attacks",
      "title": "Armor Pulverizer",
      "description": "Beta Ray Bill’s first Medium Attack Pulverizes one Armor Up effect, removing it and dealing a burst of 10,071 Direct Damage."
    },
    {
      "type": "General",
      "title": "Shocks",
      "description": "If the Buff pause is not active, Basic Attacks have a 10% chance to inflict a Shock Passive, dealing 2,014.2 Energy Damage over 25 seconds. Max stacks: 12.\nDuring a combo started with a Medium Attack, or while striking the Opponent with a Special Attack 1, the expiration rate of personal Shocks increases by 285%.\nThe final hit of Special Attacks refreshes all Shocks on the Opponent.\nAll Shocks are paused during the Opponent’s Special Attacks and Beta Ray Bill’s Special Attack 2.\nWhen any Shock on the Opponent ends, deal a burst of 6,042.6 Energy Damage."
    },
    {
      "type": "Special Attack 1",
      "title": "Special Attack 1",
      "description": "On activation, gain an Fury Buff, granting +6,042.6 Attack Rating for 15 seconds. Max stacks: 3.\nDuring this attack, the potency of personal bursts of damage is increased by 200%\nWhile the personal Buff pause is active, when any Shock ends on the Opponent during this attack, inflict a personal Shock Passive."
    },
    {
      "type": "Special Attack 2",
      "title": "Special Attack 2",
      "description": "The first hit grants a non-stacking 15% Energize Buff for 15 seconds.\nAll lightning hits inflict a personal Shock Passive. Each Intensify Buff grants a 10%  chance to inflict these Shocks through Block."
    },
    {
      "type": "Special Attack 3",
      "title": "Special Attack 3",
      "description": "Gain a 100% Resonance Buff for 20 seconds, paused during Special Attack."
    }
  ]
}
```

Desired JSON Output:

```json
{
  "abilities": [
    {
      "name": "Ignore Damage",
      "source": "Dupe & Personal Unstoppable Active → 20-100% Reduction, except SP3"
    },
    { "name": "Shock", "source": "Passive, Basic Attacks → 10% Chance" },
    { "name": "Shock", "source": "Special Attacks → Refresh all Shocks" },
    { "name": "Shock", "source": "Passive, SP2 → Lightning Hits" },
    { "name": "Fury", "source": "SP1 → 15s, Max 3" },
    { "name": "Steady", "source": "Immunity triggers" },
    { "name": "Steady", "source": "Start Fight & Against Tech" },
    {
      "name": "Power Gain",
      "source": "Passive, Power Drain immunity triggers → 1 Bar of Power → 14s Cooldown"
    },
    { "name": "Pulverize", "source": "First Medium Attack" },
    { "name": "Grit", "source": "Heavy Attack" },
    { "name": "Unstoppable", "source": "Charging Heavy Attack" },
    {
      "name": "Intensify",
      "source": "Charging Heavy Attack → Every 0.4s up to 5 stacks"
    },
    {
      "name": "Intimidate",
      "source": "Passive, Charging Heavy & 2+ Bars of Power & Below 2 stacks of Intensify"
    },
    {
      "name": "Infuriate",
      "source": "Passive, Charging Heavy & 2+ Bars of Power & Max Intensify"
    },
    { "name": "Burst Damage", "source": "Direct, Pulverize" },
    { "name": "Burst Damage", "source": "Energy, Shock expires" },
    { "name": "Energize", "source": "SP2 → 15s" },
    { "name": "Resonance", "source": "SP3 → 20s" }
  ],
  "immunities": [
    { "name": "Shock", "source": "" },
    { "name": "Power Drain", "source": "" }
  ]
}
```

--- END EXAMPLE 1 ---

--- EXAMPLE 2 ---
Champion Name: Galan
"full_abilities" JSON:

```json
{
    "signature": {
        "name": "HUMBLE GOD OF THE BATTLEREALM",
        "description": "Always Active\nWhenever Galan prevents a Power Drain, Burn, Lock or Special Lock effect from a non-Mystic Champion via immunity, he gains 1 - 3 indefinite Physical Resistance and Energy Resistance Buffs (Rounded Up). These Buffs are the same as those gained from striking the Opponent with the Staff of Taa.\nWhile the Harvest is active: Galan becomes Stun Immune and deals a burst of 96.9 - 301.35 Direct Damage whenever Galan gains any amount of Planetary Mass, this Damage scales with Base Attack only."
    },
    "abilities_breakdown": [
        {
            "type": "Passive",
            "title": "Solar Intensity",
            "description": "Solar Intensity - Max 3\nGalan starts each quest with 1 Persistent Solar Intensity. This becomes 2 when Defending, and 3 if Defending a final boss node.\nWhen Galan defeats a non-#Dimensional being, he gains 1 additional Solar Intensity.\nAt the start of the fight gain 1 indefinite Intensify Passive for each Solar Intensity, each increasing the potency of all future Buffs by 20%.
At 3 Solar Intensity, all of Galan’s Special Attacks gain a True Sense Buff, bypassing the effects of Miss and Auto-Block."
        },
        {
            "type": "Passive",
            "title": "Taa'an Biology",
            "description": "Taa’an Biology - Always Active\nGalan’s otherworldly nature provides immunity to Fate Seals and Nullify effects.\nAdditionally, the Staff of Taa preserves Galan’s Power and grants immunity to Power Drain, Burn, Lock and Special Lock.\nGalan’s first Light Attack and second Medium Attack strike with the Planetary side of the Staff of Taa, granting Galan 1 indefinite Resist Physical Buff, increasing Physical Resistance by 99.74. Max 20.\nGalan’s first Medium Attack strikes with the Solar side of the Staff of Taa, granting Galan 2 indefinite Resist Energy Buffs, increasing Energy Resistance by 99.74. Max 20.\nBuilding additional Resistance Buffs while at their maximum quantity will replace previous versions with an updated Potency."
        },
        {
            "type": "General",
            "title": "Planetary Mass and Harvest",
            "description": "Planetary Mass and Harvest\nWhenever Galan gains a Buff, his Planetary Mass is increased by 10. Galan also gains 50 Planetary Mass whenever the Opponent gains an Armor Up effect. Max 999.\nWhenever Galan is knocked down by a Special Attack, he loses 30 Planetary Mass per bar of Power spent.\nLanding a Heavy Attack with 100 or more Planetary Mass will trigger the Harvest. Activating the Harvest on Attack prevents Galan from building Power if over 1 Bar of Power.\nOn Defense, the Harvest activates when Galan reaches 100 or more Planetary Mass.\nThe Harvest lasts for 14 seconds, when the Harvest ends, Galan consumes all Planetary Mass to deal a burst of 585.7 Direct Damage for each Planetary Mass consumed, this Damage scales with Base Attack only and is halved on Defense.\nWhile the Harvest is active, Galan gains an Unstoppable Buff and a Regeneration Buff, healing 298.59 Health per second.\nIf Galan performs a Special Attack while the Harvest is active, it becomes Unblockable and the Harvest ends. The burst of Damage triggers on the final hit of the Special Attack."
        },
        {
            "type": "Special Attack 1",
            "title": "Special Attack 1",
            "description": "On activation, Galan gains 4 Fury Buffs, these Furies last for 26 second(s) and increase Attack Rating by 813.44.\nWhile the Harvest is active: Convert all of Galan’s Resistance Buffs into 5 Planetary Mass each."
        },
        {
            "type": "Special Attack 2",
            "title": "Special Attack 2",
            "description": "On activation, Galan gains 8 Intensify Buffs, each lasting 22 second(s) and increasing the potency of all new Buffs by 5%.
The final 3 hits each inflict 1 Incinerate Debuff dealing 12,710 Energy Damage over 14 seconds.\nWhile the Harvest is active: Instead inflict 3 Incinerates per hit with the same Potency and Duration."
        },
        {
            "type": "Special Attack 3",
            "title": "Special Attack 3",
            "description": "Galan immediately gains 200 Planetary Mass and begins a Planetary Harvest if it is not already active.\nIf activated while the Harvest is already active, refresh the duration of the currently active Harvest and enable Galan to gain Power again."
        },
        {
            "type": "General",
            "title": "Cosmic Seed Heralds",
            "description": "Cosmic Seed Heralds\nOnce per Quest, Galan can consume 2 Solar Intensity in the Pre-Fight Menu to place a Cross-Fight Cosmic Seed on the next fight. The next Cosmic Champion excluding Galan to enter this fight gains the Seed and becomes a Herald for the rest of the Quest. Whenever a Herald emerges victorious, the Seed will grow in power to grant abilities. Victories max out at 5.\n0+ Victories - Heralds reduce the potency of all Power Burn effects by 100%.
1+ Victories - Heralds gain a 7% Resistance to all Damaging Debuffs for each Victory.
2+ Victories - Heralds become Unblockable when launching a Special Attack into an Opponent’s block, this Buff lasts for the duration of the Special Attack with an additional 1 second(s) added for each Victory. Once activated, this ability goes on cooldown for 24 seconds, and won't trigger while it's active."
        }
    ]
}
```

Desired JSON Output:

```json
{
  "abilities": [
    {
      "name": "True Sense",
      "source": "On Special Attacks & 3+ Solar Intensity"
    },
    { "name": "True Sense", "source": "On Special Attacks & Harvest" },
    { "name": "Physical Resist", "source": "First Light Attack" },
    { "name": "Physical Resist", "source": "Second Medium Attack" },
    {
      "name": "Physical Resist",
      "source": "Dupe & Power Control Immunity (Non-Mystic)"
    },
    { "name": "Energy Resist", "source": "First Medium Attack" },
    {
      "name": "Energy Resist",
      "source": "Dupe & Power Control Immunity (Non-Mystic)"
    },
    { "name": "Unstoppable", "source": "Harvest" },
    { "name": "Regeneration", "source": "Harvest" },
    { "name": "Fury", "source": "SP1 → 26s" },
    {
      "name": "Intensify",
      "source": "Passive, Start of Fight (Solar Intensity based)"
    },
    { "name": "Intensify", "source": "SP2 → 22s" },
    { "name": "Incinerate", "source": "SP2" },
    { "name": "Pre-Fight Ability", "source": "Cosmic Seed Heralds" },
    { "name": "Stun Immune", "source": "Dupe & Harvest Active" },
    {
      "name": "Burst Damage",
      "source": "Dupe & Gain Planetary Mass (Harvest Active)"
    },
    { "name": "Burst Damage", "source": "Harvest Ends (Planetary Mass based)" }
  ],
  "immunities": [
    { "name": "Fate Seal", "source": "" },
    { "name": "Nullify", "source": "" },
    { "name": "Power Drain", "source": "" },
    { "name": "Power Burn", "source": "" },
    { "name": "Power Lock", "source": "" },
    { "name": "Special Lock", "source": "" }
  ]
}
```

--- END EXAMPLE 2 ---

--- EXAMPLE 3 ---
Champion Name: Gamora
"full_abilities" JSON:

```json
{
    "signature": {
        "name": "DEADLIEST WOMAN IN THE GALAXY",
        "description": "Special Attacks - Godslayer Strike\nGamora’s skill with the Godslayer Blade grows, increasing the chance to activate it during Special Attacks to 100%. Additionally, the cooldown is reduced to 50 - 20 seconds."
    },
    "abilities_breakdown": [
        {
            "type": "Light Attacks",
            "title": "Light Attacks",
            "description": "65% chance to gain a Fury Buff, granting +1,689.44 Attack Rating for 14 seconds. Max: 25."
        },
        {
            "type": "Medium Attacks",
            "title": "Medium Attacks",
            "description": "65% chance to gain a Cruelty Buff, increasing Critical Damage Rating by 85.05 for 14 seconds. Max: 25."
        },
        {
            "type": "Passive",
            "title": "Always Active",
            "description": "Gamora’s personal Buffs gain +1.5% duration for every 1 seconds that have passed during the fight. Max bonus: +60%.
If Gamora has 8 or more personal Buffs active, her attacks cannot Miss."
        },
        {
            "type": "Heavy Attacks",
            "title": "Heavy Attacks",
            "description": "Refreshes the duration of all personal Buffs."
        },
        {
            "type": "General",
            "title": "Special Attacks - Godslayer Strike",
            "description": "Gamora begins each fight with a Godslayer Strike ready, which has a 65% chance to activate during each Special Attack. Once Godslayer Strike is used, it goes on Cooldown for 100 seconds."
        },
        {
            "type": "Special Attack 1",
            "title": "Special Attack 1",
            "description": "This attack has 100% Critical Hit Chance.
100% chance to inflict Bleed, dealing 10,559 Direct Damage over 5 seconds.
Godslayer: Attack gains a flat +600% Critical Damage Multiplier."
        },
        {
            "type": "Special Attack 2",
            "title": "Special Attack 2",
            "description": "This attack has 100% Critical Hit Chance.
80% chance to inflict an Armor Break Debuff, removing 1 Armor Up Buff and reducing Armor Rating by 523.81 for 18 seconds.
Godslayer: Armor Break Debuffs during the attack gain +50% Potency, +60% Duration and +150% Ability Accuracy."
        },
        {
            "type": "Special Attack 3",
            "title": "Special Attack 3",
            "description": "100% Chance to gain a True Strike Buff for 14 seconds, allowing this Champion to ignore Armor, Resistances, Auto-Block and all Evade effects.
Godslayer: 100% chance to inflict a Shock Debuff causing 21,118 Energy Damage over 10 seconds. If the opponent is a Robot, instead inflict a Degeneration Debuff that deals double damage."
        }
    ]
}
```

Desired JSON Output:

```json
{
  "abilities": [
    { "name": "True Strike", "source": "SP3 → 14s" },
    { "name": "Cannot Miss", "source": "Passive, 8+ Buffs" },
    { "name": "Fury", "source": "Light Attacks → 65% Chance, 14s" },
    { "name": "Cruelty", "source": "Medium Attacks → 65% Chance, 14s" },
    { "name": "Bleed", "source": "SP1" },
    { "name": "Armor Break", "source": "SP2 → 18s" },
    { "name": "Shock", "source": "SP3 & Godslayer Strike" },
    {
      "name": "Degeneration",
      "source": "SP3 & Godslayer Strike & Opponent Robot/Shock Immune"
    },
    {
      "name": "Godslayer Strike",
      "source": "Special Attacks → 65% Chance (100% Dupe)"
    }
  ],
  "immunities": []
}
```

--- END EXAMPLE 3 ---

--- EXAMPLE 4 ---
Champion Name: Korg
"full_abilities" JSON:

```json
{
    "signature": {
        "name": "ROCK HARD THORNS",
        "description": "When Attacked\nWhile Rock Shield is active and Korg is struck by a Medium, Heavy or Special Attack that makes contact, 4,547.5 - 12,731.78 Physical Damage is inflicted to the opponent. Damage scales with Base Attack only. This ability does not activate if the opponent’s hit deals Energy Damage and Mutant Champions take 25% less damage.\nWhile Rock Shield is active, Korg has a 30.58 - 69.99% chance to Purify Debuffs and gain one Rock Shield charge for each Debuff Purified this way."
    },
    "abilities_breakdown": [
        {
            "type": "Passive",
            "title": "Rock Anatomy",
            "description": "Rock anatomy provides Korg immunity to Bleed, Shock and additional Critical Resistance but decreases his Energy Resistance by 20%."
        },
        {
            "type": "Passive",
            "title": "Crowd Excitement - Miek Appearance",
            "description": "The crowd goes crazy when Miek makes an appearance while Korg is blocking an attack, increasing Crowd Excitement by 1 for 20 seconds. +2 on Well Timed Blocks. Only 6 Crowd Excitement charges can be gained through this ability."
        },
        {
            "type": "Passive",
            "title": "Crowd Excitement - Opponent Evade/Dexterity",
            "description": "The crowd dislikes cowards, cheering for Korg when opponents Evade or Dexterity his Basic Attacks, increasing Crowd Excitement by 3 for 20 seconds. Only 12 Crowd Excitement charges can be gained through this ability."
        },
        {
            "type": "Conditional",
            "title": "Crowd Excitement Threshold",
            "description": "When Crowd Excitement reaches 6 or more, Korg becomes Unstoppable and Unblockable for 2 seconds."
        },
        {
            "type": "Heavy Attacks",
            "title": "Miek Expels Fluids",
            "description": "Miek expels fluids on opponents when hitting with a Heavy Attack, creeping out the crowd and consuming all Crowd Excitement to inflict Armor Break, reducing their Armor Rating by 1,027.47 for each Crowd Excitement charge for 8 seconds."
        },
        {
            "type": "Passive",
            "title": "Rock Shield - Charges",
            "description": "Korg begins the fight with 9 Rock Shield charges which are removed each time he is struck. An additional charge is removed when Korg’s Dash Attack is interrupted by a Light Attack and if Struck by a Special Attack 3, all Rock Shield charges are removed instead."
        },
        {
            "type": "Passive",
            "title": "Rock Shield - Damage Cap",
            "description": "While Rock Shield is active, powerful enemy attacks cannot deal more than 40% of the opponent's Base Attack Rating in a single hit. Special 3 Attacks cannot deal more than 120% of the opponent's Attack instead."
        },
        {
            "type": "Passive",
            "title": "Rock Shield - Reformation",
            "description": "When all charges are consumed, Rock Shield is shattered and it takes between 11 and 15 seconds to reform. Each time Rock Shield reforms it starts with 1 less charge."
        },
        {
            "type": "Special Attack 1",
            "title": "Special Attack 1",
            "description": "Opponents cannot Evade this attack.
This attack is Unblockable if Crowd Excitement is greater than 1."
        },
        {
            "type": "Special Attack 2",
            "title": "Special Attack 2",
            "description": "+10,911.6 Attack Rating for 2.5 seconds if Korg is Unblockable.
Inflicts Bleed, dealing 10,002.3 Direct Damage over 8 seconds."
        },
        {
            "type": "Special Attack 3",
            "title": "Special Attack 3",
            "description": "Crowd Excitement goes up by 9 for 20 seconds."
        }
    ]
}
```

Desired JSON Output:

```json
{
  "abilities": [
    { "name": "Purify", "source": "Dupe & Rock Shield active → 30-70% Chance" },
    { "name": "Unstoppable", "source": "Passive, 6+ Crowd Excitement → 2s" },
    { "name": "Unblockable", "source": "Passive, 6+ Crowd Excitement → 2s" },
    { "name": "Unblockable", "source": "SP1 & 1+ Crowd Excitement" },
    {
      "name": "Armor Break",
      "source": "Heavy Attack (consumes Crowd Excitement) → 8s"
    },
    { "name": "Cannot be Evaded", "source": "SP1" },
    { "name": "Bleed", "source": "SP2 → 8s" },
    { "name": "Fury", "source": "Passive, SP2 While Unblockable → 2.5s" },
    {
      "name": "Reflect Damage",
      "source": "Physical, Dupe & Struck by Contact Medium/Heavy/Special (Rock Shield active, non-Energy hit)"
    }
  ],
  "immunities": [
    { "name": "Bleed", "source": "" },
    { "name": "Shock", "source": "" }
  ]
}
```

--- END EXAMPLE 4 ---

**Now, for the new champion:**

Champion Name: [Champion Name]
"full_abilities" JSON:

```json
[full_abilities JSON for the new champion]
```

**Generate ONLY the JSON object for this new champion, strictly following all rules and examples provided.**

```

```
