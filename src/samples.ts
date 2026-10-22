// Example practice sets. Written for Satchel; the content is general knowledge, not taken from any textbook.

export interface SampleSet {
  id: string
  label: string
  text: string
}

export const SAMPLE_SETS: SampleSet[] = [
  {
    id: 'fractions',
    label: 'Fractions (maths)',
    text: `# Fractions of a number
Work out each answer, then check it. There is no time limit.

1. What is 3/4 of 20?
a) 12
b) 15 *
c) 18
d) 5
Hint: Find 1/4 of 20 first.
Why: 1/4 of 20 is 5, so 3/4 of 20 is 3 x 5 = 15.

2. Write 0.5 as a fraction in its simplest form.
Answer: 1/2 | one half | a half
Why: 0.5 means 5 tenths, and 5/10 simplifies to 1/2.

3. True or false: 2/4 is the same as 1/2.
* True
- False
Why: Dividing the top and bottom of 2/4 by 2 gives 1/2.

4. Which is bigger: 2/3 or 3/5?
a) 2/3 *
b) 3/5
c) They are equal
Hint: Write both with the same bottom number, 15.
Why: 2/3 = 10/15 and 3/5 = 9/15, so 2/3 is bigger.

5. A pizza is cut into 8 equal slices. Ali eats 3. What fraction of the pizza is left?
Answer: 5/8 | five eighths
Why: 8 - 3 = 5 slices are left out of 8.`,
  },
  {
    id: 'plants',
    label: 'Photosynthesis (science)',
    text: `# How plants make food
Plants make their own food in their leaves. This is called photosynthesis.

1. Which gas do plants take in from the air to make food?
a) Oxygen
b) Carbon dioxide *
c) Nitrogen
Why: Leaves take in carbon dioxide through tiny holes called stomata.

2. What gives leaves their green colour?
Answer: chlorophyll
Hint: It starts with "chloro", which means green.
Why: Chlorophyll is the green substance that absorbs light energy.

3. Which gas do plants give out during photosynthesis?
a) Oxygen *
b) Carbon dioxide
c) Water vapour only
Why: Plants release oxygen, which animals and people breathe.

4. Plants need light, water and carbon dioxide. What do they make from them?
a) Sugar (glucose) and oxygen *
b) Soil and water
c) Salt and carbon dioxide
Why: Light energy turns water and carbon dioxide into glucose and oxygen.`,
  },
  {
    id: 'words',
    label: 'Everyday English words',
    text: `# Words for daily life
Choose the word that fits. Read each sentence aloud if it helps.

1. I need to ___ the bus at 8 o'clock.
a) catch *
b) hold
c) pick
Why: In English we "catch" a bus, a train or a plane.

2. Which word means "the money you pay to see a doctor"?
a) fee *
b) fare
c) fine
Why: A fee is paid for a service. A fare is paid for a journey, and a fine is a punishment.

3. Complete the sentence: "The shop is closed today, ___ it opens tomorrow."
Answer: but
Hint: You need a word that shows a contrast.

4. What is the opposite of "early"?
Answer: late`,
  },
]
