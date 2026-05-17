# AIVO Brain Clone — The Building Sequence

## The Onboarding Context

At the point of Brain cloning, the parent is onboarding their child. The child has just completed the Discovery Adventure (baseline assessment). The parent is on their device watching the results come in. The Building Sequence plays on the parent's screen as a single experience. There is no separate child-facing animation during cloning. The parent watches the Brain being built, reviews it, and decides what happens next.

When the parent approves the Brain, the child's learner account activates. The first time the child opens their learner dashboard, they see their Brain already alive and populated, with the grade ladders, accommodations, and goal paths visible inside it. The child can explore their Brain at that point, but they did not watch it being built. The parent did.

---

## The Actual Brain Clone Pipeline (What Happens Technically)

For reference, here is the real backend pipeline that the animation represents:

1. Select seed template matching grade band, disability profile, and functioning level
2. Deep copy the seed template into a new Brain state
3. Inject domain scores from the assessment into mastery levels
4. Inject disability signals from parent assessment and IEP
5. Inject functioning level profile (communication mode, response type, attention span)
6. Inject sensory profile (visual, auditory, tactile, vestibular, proprioceptive sensitivities)
7. Inject IEP data (goals, accommodations, communication system, assistive technology)
8. Resolve accommodations (merge assessment-derived and IEP-parsed accommodations into active set)
9. Map IEP goals to curriculum alignment targets
10. Initialize functional curriculum tracker (if LOW_VERBAL or above)
11. Save initial version snapshot
12. Insert brain_states record
13. Clone PyTorch BKT mastery model for this learner
14. Seed Redis episodic memory namespace

The animation shows each of these steps as a visible construction event on the parent's screen.

---

## The Building Sequence (Parent's Screen)

### The Visual Metaphor: Blueprint to Building

The parent watches their child's Brain being built like a structure, layer by layer. The Brain is rendered as a translucent, cross-section diagram with labeled compartments: "Reading," "Math," "Science," "Social-Emotional," "Communication," "Executive Function." Each compartment contains a grade ladder showing where the child functions relative to their enrolled grade. The animation is informative, not decorative. The parent sees real data entering the Brain at every stage.

The visual style is clean, warm, and professional. AIVO purple and teal palette. Rounded shapes, soft gradients. It looks like a beautiful, animated infographic, not a cartoon or a clinical report. The parent feels they are watching something sophisticated and trustworthy being assembled from their child's data.

### Stage 1: Template Selection (0-3 seconds)

**What is happening:** The system selects a seed template matching the child's grade band, disability profile, and functioning level, then deep-copies it.

**What the parent sees:** A clean canvas. From the top of the screen, a translucent blueprint of a brain shape descends and settles in the center. It is a see-through outline with labeled compartments visible inside, all empty, drawn as dotted outlines waiting to be filled.

A label appears: "Grade [X] Brain Template — [Functioning Level]" using the child's actual data. For example: "Grade 6 Brain Template — Standard Functioning" or "Grade 3 Brain Template — Supported Functioning."

A brief text caption appears below: "Selecting a baseline Brain template for [Child's name]'s grade level and learning profile."

The parent understands: the system is not starting from scratch. It is starting from a template designed for children at this grade and functioning level.

### Stage 2: Domain-Level Assessment Results (3-10 seconds)

**What is happening:** Domain scores from the Discovery Adventure are injected into mastery levels. Each domain gets a grade-equivalent delivery level.

**What the parent sees:** Each compartment fills one at a time. Inside each compartment, a grade ladder appears: a vertical scale with grade markers (K, 1st, 2nd, 3rd, 4th, 5th, 6th, etc. up to the enrolled grade). The enrolled grade is marked at the top with a small flag. As the compartment activates, color fills from the bottom up to the child's actual functioning grade for that domain. A glowing marker lands on the functioning grade.

**Reading fills first.** Warm amber rises and the marker lands on Grade 3.2. A data label appears beside the ladder: "Reading: Grade 3.2 / Enrolled: Grade 6 / Gap: 2.8 years." The space between Grade 3.2 and Grade 6 is shown as an illuminated dotted path with small stepping-stone markers, a trail to be walked, not a deficit.

**Math fills next.** Cosmic blue rises and the marker lands on Grade 4.5. Label: "Math: Grade 4.5 / Enrolled: Grade 6 / Gap: 1.5 years."

**Science fills.** Green rises. Label: "Science: Grade 5.1 / Enrolled: Grade 6 / Gap: 0.9 years."

**Social-Emotional fills.** Pink rises. Label: "Social-Emotional: Grade 4.0 / Enrolled: Grade 6 / Gap: 2.0 years."

**Communication fills (if assessed).** Purple rises with milestone markers instead of grade numbers if the child is LOW_VERBAL or below.

**Executive Function fills (if assessed).** Shows attention span, working memory, and cognitive flexibility as milestone markers.

A summary caption appears below the Brain: "[Child's name] is enrolled in Grade 6. Their Brain will deliver content at their actual functioning level per subject, not at Grade 6 across the board. As mastery improves in each domain, the delivery level rises automatically."

The parent can see at a glance: which subjects are strongest, which have the biggest gaps, and that every domain is at a different level. This is the most important information in the entire onboarding, and it is presented clearly, visually, and without clinical coldness.

### Stage 3: Learning Preferences and Accommodations (10-13 seconds)

**What is happening:** The functioning level profile, sensory profile, and disability signals are injected. Accommodations are resolved from assessment data and IEP.

**What the parent sees:** Around the outside of the brain shape, a ring of accommodation and preference cards appears. Each card is a clean, labeled tile showing one accommodation or learning preference with the evidence that triggered it.

"Extended Time (1.5x) — Response latency averaged 8.2 seconds (threshold: 5s)"
"Audio Narration (Auto-play) — Reading level 3.2 is 2+ grades below enrolled grade"
"Visual Supports — Sensory profile: visual hyper-sensitivity; IEP specifies visual schedule"
"Reduced Choices (3 max) — Functioning level: Supported"
"Sensory-Calm Colors — Sensory profile: visual hyper-sensitivity"
"Frequent Breaks — Attention span: 8 minutes (assessed)"

Only the accommodations that apply to this child appear. Each card shows the reason it was activated, so the parent can see that nothing is arbitrary. If an IEP was uploaded, accommodations sourced from the IEP are labeled: "From IEP" with a small document icon.

A caption: "These accommodations will be applied to every lesson, tutor session, and homework activity automatically. You can adjust these at any time from your parent dashboard."

The parent understands: the system is not just tracking what my child knows. It is configuring how the platform communicates with my child, based on evidence.

### Stage 4: Goal Mapping and Learning Paths (13-17 seconds)

**What is happening:** IEP goals are mapped to curriculum alignment targets. The Brain maps the stepping-stone path from current delivery level to enrolled grade for each domain.

**What the parent sees:** The grade ladders from Stage 2 reactivate. The dotted paths between the child's current marker and their enrolled grade flag populate with labeled stepping stones. Each stepping stone represents a real skill cluster.

For Reading (Grade 3.2 to Grade 6), the path shows concrete steps: "Paragraph comprehension" then "Main idea identification" then "Inference from context" then "Textual evidence" then "Grade-level vocabulary" then "Grade 6 reading." Each step is a small labeled node on the path.

For Math (Grade 4.5 to Grade 6), the path is shorter: "Multi-digit operations" then "Fractions and decimals" then "Ratios and equations" then "Grade 6 math."

If an IEP was uploaded, IEP goal markers pin themselves to specific points on the grade ladders as star-shaped pins. The parent sees the exact IEP goal text mapped to the ladder position: "IEP Goal: 'Read grade-level text with 80% accuracy' — mapped to Grade 6.0 on Reading ladder." "IEP Goal: 'Solve 2-step word problems' — mapped to Grade 5.0 on Math ladder."

A caption: "Your child's Brain has planned a step-by-step path for every subject. Content will be delivered at [Child's name]'s actual level, targeting their enrolled grade objectives. IEP goals are integrated into the same paths."

If IEP was uploaded, an additional line: "AIVO will track progress toward each IEP goal and generate formatted progress reports for IEP meetings."

An estimated timeline appears as a range (never a promise): "Based on [Child's name]'s assessment data and typical progression rates, estimated gap closure: Reading 8-14 months, Math 4-8 months, Science 2-4 months (with 4+ sessions per week)."

The parent understands: there is a concrete, step-by-step plan for every domain. IEP goals are not separate from the learning path. The system has a realistic estimate of how long this will take. This is not vague "adaptive learning." This is a mapped journey with named stops.

### Stage 5: System Activation (17-20 seconds)

**What is happening:** The PyTorch BKT mastery model is cloned. Redis episodic memory is seeded. The brain_states record is inserted. The initial version snapshot is saved.

**What the parent sees:** The brain shape, now filled with domain grade ladders, ringed with accommodation cards, and threaded with goal paths, begins to activate. Light pulses through the internal pathways connecting all compartments. Each compartment transitions from a flat fill to a gently animated, living texture: the Reading section shows tiny floating letters, the Math section shows softly orbiting numbers, the Science section shows bubbling particles.

A version indicator appears: "Brain v1.0 — Initial snapshot saved." A small lock icon: "Encrypted (AES-256). Full rollback available." A memory timeline starts: a horizontal line with a single dot labeled "Today."

A caption: "[Child's name]'s Brain is now active. It will update after every learning session. All changes are versioned. You can roll back to any previous state at any time. Your child's Brain data is encrypted and you can export or delete it at any time."

The parent understands: this is a versioned, secure, reversible system. It is not a black box that changes unpredictably. Every change is tracked and the parent retains full control.

### Stage 6: Tutor Connections (20-22 seconds)

**What is happening:** The brain.cloned NATS event fires. learning-svc initializes the first learning path. Tutor availability is determined based on active subscriptions.

**What the parent sees:** Lines extend outward from the Brain to small tutor character icons arranged around it. Each line is labeled with the subject and the child's delivery level for that subject.

Nova (Math) connects with a label: "Will teach at Grade 4.5 level."
Sage (ELA) connects: "Will teach at Grade 3.2 level."
Spark (Science) connects: "Will teach at Grade 5.1 level."
Harmony (SEL) connects: "Will teach at Grade 4.0 level."

If additional tutors are subscribed, their connections appear too. If tutors are not yet subscribed, they appear grayed out with a small lock: "Subscribe to unlock."

A caption: "Every tutor reads [Child's name]'s Brain before each session. They know the exact level to teach at, which accommodations to apply, and which skills to target next."

The parent understands: the tutors are not generic chatbots. Each one is calibrated to my child's specific level in their subject. The Brain is the central control that powers everything.

---

## After the Building Sequence: The Parent Decision

The Building Sequence completes and the Brain is now fully visible, a living, detailed, data-rich visualization of everything the system knows about the child. The parent has watched every piece of data go in and understands what the Brain contains.

Now the parent sees three clear action buttons below the Brain:

### Option 1: "Approve Brain" (Primary, green button)

Tapping this activates the Brain immediately. The child's learner account goes live. The first learning path is generated. The child can now open AIVO and begin learning. The Brain is locked as v1.0 and begins evolving from the first session.

The parent sees a confirmation: "[Child's name]'s Brain is active. Their first learning session is ready."

### Option 2: "Add Context and Rebuild" (Secondary, blue button)

The parent has information the assessment could not capture. Tapping this opens a structured context form where the parent can add:

**Learning context:** "He is really interested in dinosaurs." "She does better in the morning." "He shuts down when frustrated, needs a break before trying again." Free text field for anything the parent wants the Brain to know.

**Clinical context:** "He has been making progress with his speech therapist on the /r/ sound." "Her OT says she has improved with fine motor tasks." "He recently started a new medication that affects focus."

**Assessment concerns:** "I think the reading score is too low, she was tired during that part." "His math is better than this, he had a bad day." "She does not do well with timed activities, the assessment might have underestimated her."

**Missing information:** "She also speaks Spanish at home, the assessment was only in English." "He uses a communication device that was not available during the assessment." "She has sensory meltdowns with certain sounds that the assessment might not have captured."

After the parent submits their context, the system re-runs the Brain clone pipeline with the parent's context injected as first-class inputs. The parent's insights modify the Brain state: if the parent says "reading score is too low, she was tired," the system can weight the reading score upward by a configurable margin and note the parent's context in the Brain's insight layer. If the parent adds "speaks Spanish at home," the language profile is initialized. If the parent adds sensory information, the sensory profile is updated.

The Building Sequence replays with the updated data. The parent sees the changes: maybe the Reading marker moved up half a grade because of the parent's context. Maybe a new accommodation appeared based on the sensory information. Maybe the language profile now shows bilingual support.

The parent can go through this cycle as many times as they want. Add context, rebuild, review. Each iteration refines the Brain. When satisfied, they tap "Approve Brain."

### Option 3: "Start Over" (Tertiary, gray button)

The parent believes the assessment results are fundamentally wrong. Maybe the child was having a terrible day. Maybe they were sick. Maybe the environment was wrong. Tapping this returns the process back to the child running the Discovery Adventure baseline assessment again from the beginning. The previous assessment data is discarded (not deleted permanently, archived for reference, but not used in the Brain clone).

A confirmation dialog appears: "This will ask [Child's name] to complete the Discovery Adventure again. The previous results will be saved but not used. Are you sure?" The parent confirms, and the child is routed back to the Discovery Adventure on their device.

This option exists because parents know their children better than any assessment. If a parent looks at the Brain and says "this is not my child," the system trusts the parent over its own data. The assessment can be re-run as many times as needed until the parent sees a Brain that matches the child they know.

---

## After Approval: The Parent's Brain Dashboard

Once the parent approves the Brain, its key information becomes permanently visible in the parent's dashboard. This is not a one-time reveal that disappears. It is a living section of the parent dashboard that updates in real time as the child learns.

### The Brain Overview Card

A prominent card on the parent dashboard showing:

**The Brain visualization** — the same cross-section view from the Building Sequence, with grade ladders per domain, accommodation ring, and goal paths. This is interactive: the parent can tap any compartment to drill into that domain's detail.

**Grade-level summary at a glance:**
- Reading: Grade 3.2 (enrolled 6) with a small progress arrow showing movement since last week
- Math: Grade 4.5 (enrolled 6) with progress arrow
- Science: Grade 5.1 (enrolled 6) with progress arrow
- Social-Emotional: Grade 4.0 (enrolled 6) with progress arrow

**Active accommodations** listed below the Brain with the ability to toggle any accommodation on or off. Changes trigger a Brain recommendation for parent confirmation.

**IEP goal progress** — each IEP goal shows current progress, baseline, target, and trend line. A "Generate IEP Report" button creates a formatted PDF for IEP meetings.

### Domain Drill-Down

When the parent taps a domain compartment on the Brain, they see:

**The grade ladder** for that domain at full size, showing: the current marker position, every stepping stone on the path with skill labels, which steps have been completed (filled), which step is currently active (glowing), and IEP goal stars pinned to the ladder.

**Recent session history** for that domain: last 5 sessions with date, duration, skill practiced, and mastery change.

**Tutor performance** for that domain: which tutor teaches this subject, how many sessions completed, average engagement score.

**Trend chart** showing the delivery level over time: a line graph from onboarding to present, with the enrolled grade as a horizontal target line. The parent can see the slope of improvement and whether the gap is closing, stable, or widening.

### Brain Version History

A timeline of every Brain change: initial clone, mastery updates, accommodation changes, parent insights added, IEP goal milestones reached. Each version is a tappable snapshot. The parent can compare any two versions side by side: "What changed between v1.0 and v1.7?" The parent can roll back to any previous version if they believe a change was counterproductive.

### Recommendation Inbox

Brain-generated recommendations appear here: "Alex has mastered Grade 4 reading comprehension. Move to Grade 4.5 content?" "Consider adding audio narration for science based on recent session patterns." "Alex met their IEP goal: 'Count to 10 with 1:1 correspondence.' Set a new target?" Each recommendation has APPROVE / DECLINE / ADD CONTEXT buttons, maintaining the same approval authority the parent exercised during the initial cloning.

---

## What the Child Sees When They First Open AIVO

After the parent approves the Brain, the child's learner account activates. The first time the child opens AIVO on their device, they see their learner dashboard with their Brain already alive in the top bar, pulsing gently with their unique color signature.

The child can tap their Brain indicator to see the cross-section view with their grade ladders, accommodations, and goal paths. They did not watch it being built in real time (the parent did), but the Brain is presented as: "This is your Brain. It knows all about you. Tap to see inside."

When the child taps, they see the grade ladders with their markers, the stepping stones ahead, and the tutor connections. The tutor assigned to their strongest domain greets them: "Hey [Name]! I already know where to start with you. Ready?"

The grade ladders are explained briefly by the tutor on first view: "See this ladder? This shows where you are in reading right now, and where you are headed. Every time we learn together, your marker climbs." The child gets an honest, encouraging framing of their levels as an exploration of their already-built Brain rather than watching it being constructed.

From this point forward, the child can open their Brain at any time to see their progress. After every session, the relevant domain marker visibly climbs if mastery improved. Half-grade movements are celebrated with tutor narration. Full grade crossings are major events with animations and badge awards.

---

## Technical Implementation

### Rendering
The brain shape is a pre-designed SVG asset with named regions (compartments) that the rendering engine fills programmatically based on domain scores. Grade ladders are rendered as vertical SVG paths with markers positioned by grade-equivalent values. The accommodation ring is a circular layout of card components. Goal stepping stones are animated SVG paths with stroke-dashoffset animation. All rendering uses the same GPU-accelerated engine as The Stage (Pixi.js for web, Flutter CustomPainter for mobile).

### Data Flow
The animation controller receives the full assessment.baseline.completed payload. It begins the animation immediately while the backend clone pipeline runs. Stage 5 (System Activation) is timed to coincide with the actual brain_states INSERT. If the backend completes faster, the remaining stages are presentational. If slower (rare, target under 10 seconds), Stage 5 extends its pulse animation until the brain.cloned NATS event is received.

### Rebuild Cycle
When the parent taps "Add Context and Rebuild," the parent's context is submitted to assessment-svc as a parent_context_update event. brain-svc receives the updated context, re-runs the clone pipeline with modified weights and injected insights, and publishes a new brain.cloned event. The Building Sequence replays on the parent's screen with updated data. The diff from the previous build is highlighted: compartments that changed level show a brief animation of the marker moving, new accommodations glow to draw attention, and removed accommodations fade out.

### Personalization Parameters
The animation is parameterized by: domainScores (determines fill levels and grade-equivalent labels per compartment), strongestDomain (determines tutor connections emphasis), functioningLevel (determines template label and accommodation set), activeAccommodations (determines which cards appear in the ring with evidence text), iepGoals (determines star pins and goal text on ladders), sensoryProfile (determines sensory accommodation cards), childName and gradeLevel (injected into labels and captions), and parentContext (any previous parent-submitted insights, shown as a distinct layer in the Brain).

### Parent Dashboard Persistence
After approval, the Brain visualization components are embedded in the parent dashboard as a permanent, real-time-updating section. The grade ladders poll brain-svc for mastery updates every time the parent opens the dashboard (or receive push updates via WebSocket for real-time viewing during active sessions). The Brain version history is backed by brain_state_snapshots in PostgreSQL. The recommendation inbox is driven by brain_recommendations with status tracking.

### Asset Budget
Total assets for the Building Sequence: brain shape SVG (50KB), grade ladder components (100KB), accommodation card templates (80KB), stepping stone icons (120KB), tutor character thumbnails (200KB), ambient sound (150KB). Total: approximately 700KB, loaded during the Discovery Adventure results processing so there is zero delay when the Building Sequence starts.

### Accessibility
Screen reader users hear each stage announced: "Selecting Brain template for Grade 6. Loading reading level: Grade 3.2. Loading math level: Grade 4.5. Adding accommodations: extended time, audio narration. Mapping goals. Brain activated." The three action buttons (Approve, Add Context, Start Over) are fully accessible with clear ARIA labels and keyboard navigation. The context form supports voice input for parents who prefer speaking over typing.

---

## What This Is NOT

This is not a fancy animation that happens to play while a database writes. This is a transparent, informative visualization of a real engineering process shown to the person who has authority over it: the parent. The parent watches their child's Brain being assembled from real data. They see the grade-level gaps honestly presented. They see the accommodations with the evidence behind each one. They see the learning paths with concrete steps. And then they decide: does this match my child? If yes, approve. If close but missing something, add context and rebuild. If wrong, start over. The parent is not a passive observer of a loading screen. The parent is the final authority in the Brain clone pipeline, and the Building Sequence gives them the information they need to exercise that authority with confidence.
