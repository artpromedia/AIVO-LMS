# AIVO Learner Interface & Experience Agent — Design Specification

## The Core Problem with Chat-Based Learning

Every AI learning platform today looks the same: a chat window with text bubbles. The learner types, the AI responds with paragraphs of text, and the child is expected to read, comprehend, and engage through a medium that actively works against how neurodiverse children learn. Autistic learners, children with ADHD, dyslexic readers, and low-functioning neurodiverse children do not learn by reading walls of text in a chat interface. They learn through what they see, what they hear, what they touch, and what they experience. AIVO's learner interface must be fundamentally different. It is not a chatbot. It is a living, breathing, multi-sensory learning environment that adapts its entire presentation layer to each child's Brain profile, sensory tolerances, and functioning level.

---

## Design Philosophy: The Learning Stage, Not a Chat Window

The learner interface is called **The Stage**. It is a full-screen, immersive learning environment where each lesson is a visual scene, not a conversation thread. The tutor is not a text bubble — the tutor is a visible, animated character who speaks, gestures, points at things, and reacts to the learner's input. Content does not scroll vertically like a chat log. Content appears on The Stage as visual elements: illustrated cards, animated diagrams, interactive objects, draggable manipulatives, picture sequences, audio narrations, and short video-style explanations. The learner does not type responses unless they choose to. They tap, drag, speak, point, swipe, match, sort, draw, and select from visual options. Every interaction produces immediate visual and audio feedback: correct answers trigger particle effects, character celebrations, and satisfying sounds; incorrect answers trigger gentle encouragement animations and the tutor character offering a visual hint, never a wall of corrective text.

---

## The Stage Layout (Screen Architecture)

The Stage is a single-screen experience with no scrolling, no sidebar navigation, and no distracting chrome. Every element is purposeful and sensory-considered.

### Top Bar (Minimal, Contextual)
A thin, translucent bar showing only: the tutor's name and tiny avatar (e.g., Nova with a small star icon), a session progress indicator (not a numeric percentage — a visual journey path showing how far along the learner is, like a trail with landmarks), a pause/break button (large, always accessible, styled as a calming cloud icon), and a parent co-view indicator (a small eye icon if a parent is watching). No back button, no hamburger menu, no settings gear. Those belong to the parent dashboard, not the learner's world.

### The Stage Area (85% of Screen)
This is the main canvas. It is NOT a chat window. It is a rich, illustrated, animated scene that changes based on the lesson content. For a math lesson with Nova, The Stage might show a cosmic landscape with planets representing numbers, and the learner drags moons between planets to solve addition problems. For a reading lesson with Sage, The Stage shows an illustrated storybook page with highlighted words that the learner taps to hear pronounced, with comprehension questions appearing as picture cards below the scene. For a science lesson with Spark, The Stage shows an interactive lab bench where the learner mixes virtual ingredients and observes animated reactions. The Stage background, color palette, animation intensity, and visual complexity all adapt in real time based on the learner's sensory profile from their Brain state.

### Tutor Character Panel (Persistent, Adaptive)
The tutor is always visible on The Stage as an animated character (not a text avatar, not an emoji, not a static image). The character has idle animations (breathing, blinking, small movements), reaction animations (celebrating, thinking, encouraging, pointing), and teaching animations (gesturing toward content, demonstrating a concept). The character speaks using text-to-speech with a warm, age-appropriate voice unique to each tutor persona. Speech is synchronized with visual highlights on The Stage content: when Nova says "look at this fraction," the fraction on The Stage glows and pulses. The tutor character's size, position, and animation intensity adapt to the learner's sensory profile. For learners with visual hypersensitivity, the character is smaller and movements are slower. For learners who respond well to animation, the character is more expressive.

### Response Zone (Bottom 15% of Screen)
This is where the learner interacts, and it is NEVER a text input field by default. The Response Zone morphs based on the question type. For multiple choice: large, illustrated answer cards (2 cards for LOW_VERBAL, 3 for SUPPORTED, 4 for STANDARD) that the learner taps. For sorting/matching: draggable objects that snap into place with satisfying haptic feedback. For verbal response: a large microphone button with a pulsing ring that the learner taps to speak their answer (Whisper STT processes it). For drawing/writing: a drawing canvas with thick, forgiving line tools. For yes/no: two large, color-coded buttons with icons (green checkmark, red X) and audio labels. For open-ended: ONLY THEN does a simplified text input appear, with word prediction, emoji support, and a "speak instead" button always available. The Response Zone always includes a "help me" button (styled as a friendly question mark character) and a "skip" button (styled as a gentle forward arrow, never punitive).

---

## Multi-Sensory Content Delivery

Every piece of content on The Stage is delivered through multiple sensory channels simultaneously, with the mix adjusted per learner.

### Visual Layer
All text on screen is accompanied by supporting imagery. Single sentences are paired with illustrated scenes. Math problems are visualized with manipulatives (fraction bars, number lines rendered as paths, geometry as tangible shapes). Vocabulary words appear with picture associations. Abstract concepts are made concrete through animated metaphors (gravity shown as a ball dropping, democracy shown as people voting with raised hands). Visual complexity (number of elements on screen, color saturation, pattern density, contrast levels) is controlled by the Brain's sensory profile. Backgrounds use calming, warm tones by default (the AIVO off-white and soft purples) but shift based on subject and tutor persona. Animations use spring-based easing (bouncy, organic movement) rather than linear transitions. All visual elements support reduced-motion mode for learners with vestibular sensitivity.

### Audio Layer
Every tutor has a distinct, warm, synthetic voice generated via high-quality TTS (not robotic, not monotone). All on-screen text has an auto-narration option that reads aloud as text appears, synchronized with visual highlights. Sound effects are sensory-profiled: celebration sounds are bright but not shrill, error sounds are gentle tones (never buzzes or harsh alerts), ambient background sounds are optional and adjustable (soft music for focus, nature sounds for calm, silence for sensory-sensitive learners). Audio narration speed adapts to the learner's processing speed (tracked by the Brain based on response times). Learners can tap any word or element to hear it spoken aloud. For LOW_VERBAL and NON_VERBAL learners, audio is the PRIMARY content delivery channel, with visuals as support, not the reverse.

### Haptic Layer (Mobile)
Correct answer taps produce a short, satisfying vibration pattern. Drag-and-drop interactions produce subtle haptic feedback as objects snap into place. The "celebration" moment at the end of an activity produces a distinct haptic pattern that the learner comes to associate with success. Haptic intensity is configurable in the sensory profile (off, light, standard).

### Interaction Layer
The learner's primary interaction mode is determined by their functioning level and updated by the Brain. STANDARD learners get full interaction: tap, drag, type, speak, draw. SUPPORTED learners get simplified interaction: larger targets, fewer options, more forgiving gesture recognition. LOW_VERBAL learners interact through tap-to-select on large picture cards, with every tap producing immediate audio and visual feedback. NON_VERBAL learners interact through switch scanning (sequential highlight with timed auto-advance or switch activation) or partner-assisted mode (the adult facilitator has a separate control panel). PRE_SYMBOLIC learners do not interact with The Stage directly; the parent sees activity guides and records observations through their own interface.

---

## The Tutor as a Character, Not a Chatbot

Each of the 14 AI tutors is a fully realized animated character with personality, voice, and teaching style. They are NOT chat avatars. They are characters that live on The Stage and interact with the learning content.

### Nova (Math)
A cosmic explorer character floating among stars. When teaching fractions, Nova literally splits a glowing planet in half. When teaching multiplication, Nova arranges star constellations into arrays. Nova's voice is warm, curious, and encouraging, with a slight sense of wonder. Nova celebrates correct answers by launching a small firework of stars.

### Sage (ELA)
A wise, friendly character surrounded by floating books and glowing words. When teaching reading, Sage opens a storybook that fills The Stage, with illustrations that animate as the story progresses. When teaching vocabulary, Sage pulls words out of the air and attaches picture meanings to them. Sage's voice is calm, narrative, and rhythmic, like a beloved storyteller.

### Echo (Speech & Language)
A playful, musical character with sound waves and speech bubbles as visual motifs. When practicing articulation, Echo shows a visual mouth diagram alongside audio modeling. When building sentences, Echo helps the learner stack word-picture blocks into sentence structures. Echo provides visual feedback on pronunciation by showing a simple waveform that the learner tries to match. Echo's voice is clear, patient, and deliberately paced.

### Compass (Life Skills)
A friendly, practical character in a real-world setting. The Stage transforms into a kitchen for cooking skills, a bus stop for transportation skills, a store for money management. Compass walks the learner through step-by-step visual sequences with real-world photography and illustrated overlays. Compass's voice is warm, calm, and reassuring, like a trusted mentor.

Each tutor's character design, animation style, and environmental theme are distinct, so the learner immediately knows which "world" they are in when they open a session. This builds familiarity, reduces anxiety (a key concern for autistic learners), and creates emotional attachment to the learning experience.

---

## Session Flow (Not a Chat Thread)

A learning session on The Stage does NOT proceed like a conversation. It proceeds like an interactive show.

### Opening (15 seconds)
The Stage fades in with the tutor's environment. The tutor character appears with a welcoming animation. The tutor speaks a personalized greeting using the learner's name and references something from their last session: "Welcome back, Alex! Last time we explored fractions with pizza. Today we are going to try something new." During this greeting, a gentle ambient sound fades in, and the session progress path appears at the top.

### Warm-Up (1-2 minutes)
Spaced repetition review of a previously learned concept. Presented as a quick, visual mini-game (not a quiz). For example, a matching game where the learner pairs fraction visuals with their numeric representations. Correct matches trigger satisfying snap animations and a small XP indicator floats up. The tutor reacts with encouragement.

### Core Lesson (3-8 minutes, adapted to attention span)
The tutor introduces the new concept through a visual demonstration on The Stage, not through text explanation. Nova might show a visual transformation (one whole pizza being cut into slices) while narrating. The learner then practices through 3-5 interactive activities on The Stage. Each activity uses a different interaction modality (drag, tap, speak, match) to maintain engagement. The tutor provides real-time feedback through character animations and brief spoken phrases, never through paragraphs of corrective text. If the learner struggles, the tutor does not repeat the same approach; it pivots to a different visual metaphor or simplifies the interaction.

### Check (1-2 minutes)
A brief mastery check presented as a fun challenge, not a formal test. For example, a timed matching game or a "help the character solve this puzzle" scenario. The learner receives visual stars or points, not a numeric score.

### Celebration & Close (30 seconds)
Regardless of performance, the session ends with celebration. The tutor character performs a congratulatory animation. XP and coins float onto the screen with satisfying sound effects. The learner sees their streak update visually (a flame grows larger). A brief preview teases the next session: "Next time, we are going to explore something really cool." The Stage fades out gently.

### Total session length
Adapted per attention span from the Brain: STANDARD 10-15 minutes, SUPPORTED 8-12 minutes, LOW_VERBAL 3-5 minutes, NON_VERBAL 2-3 minutes. The session timer is invisible to the learner (no countdown clock, which creates anxiety). The tutor gracefully wraps up when the time limit approaches.

---

## Sensory-Adaptive Rendering Engine

The Stage's rendering engine reads the learner's sensory profile from the Brain at session start and continuously adjusts.

### Visual Sensitivity Adaptations
For visual hyper-sensitivity: reduce color saturation by 30%, use muted backgrounds, eliminate flashing or rapid animations, reduce the number of on-screen elements to a maximum of 3, increase spacing between interactive elements, use soft shadows instead of hard borders. For visual hypo-sensitivity: increase contrast, use bold outlines, make interactive elements pulse gently to draw attention, use brighter accent colors.

### Auditory Sensitivity Adaptations
For auditory hyper-sensitivity: reduce all sound volumes by 40%, eliminate sudden sound effects, use gradual audio fades for all transitions, offer a visual-only mode where the tutor's speech appears as subtitles instead of audio. For auditory hypo-sensitivity: increase narration volume, add a secondary audio cue (a gentle chime) before important instructions, slow down speech rate for processing time.

### Motion Sensitivity Adaptations
For motion sensitivity: disable all parallax effects, reduce animation duration by 50%, use simple fade transitions instead of slide/bounce, disable the tutor character's idle animations (character is still but present), replace particle effects (confetti, stars) with simple glow effects.

### Cognitive Load Adaptations
Based on the Brain's attention span and cognitive load estimates: fewer elements per screen, longer pauses between activities, more frequent micro-breaks (a 10-second breathing animation between activities), simpler language in tutor narration, explicit step-by-step sequencing with visual step indicators.

---

## Accessibility and Interaction Modes

### Switch Access Mode
For learners using physical switches: The Stage highlights interactive elements sequentially with a visible scanning indicator (a glowing border that moves from element to element at a configurable speed). The learner activates their switch to select the currently highlighted element. All Stage content is linearized into a logical scan order. Dwell time is configurable per learner.

### Eye Gaze Mode
For learners using eye tracking devices: interactive elements have enlarged target areas. A gaze indicator shows the learner where they are looking. Selection is confirmed by dwelling on an element for a configurable duration (default 1.5 seconds). A visual "filling" animation shows the dwell progress.

### Partner-Assisted Mode
The adult facilitator sees a companion screen (on their own device or a split view) with: the current Stage content, the tutor's intended interaction, a guide for what to say/do with the child, and response recording buttons ("Looked at A," "Reached for B," "Vocalized," "No clear response"). The child's screen shows simplified visuals only.

### Voice-First Mode
For learners who communicate verbally but cannot read well: all text is hidden. Content is delivered entirely through the tutor's spoken narration and visual illustrations. Response options are spoken aloud by the tutor and represented only as pictures. The learner responds by speaking or tapping pictures.

---

## The Learner Dashboard (Not The Stage)

When the learner is not in an active session, they see their personal dashboard, which is NOT The Stage. The dashboard is a visual, playful home screen.

### World Map
A colorful, illustrated map showing the learner's quest worlds (one per tutor). Completed chapters are shown as lit-up landmarks. The current chapter glows with an inviting animation. Locked worlds are shown in gentle gray with a lock icon (not grayed out entirely, which feels punishing). Tapping a world zooms into that tutor's environment and starts or resumes a session.

### Avatar & Profile
The learner's customized avatar displayed prominently. Their current level, XP bar (visual, not numeric for younger/lower-functioning learners), streak flame, and coin/gem counts. A "dress up" button to access the avatar shop.

### Daily Challenge Card
One or two daily challenges presented as illustrated mission cards. "Complete 2 math activities with Nova" shown as a picture of Nova with 2 stars to fill in. Progress shown visually (stars fill in as activities complete).

### Badge Cabinet
A visual display of earned badges, arranged like trophies on shelves. New badges have a sparkle animation. Tapping a badge shows a full-screen celebration replay.

### Quick Start Buttons
Large, illustrated buttons for each active tutor: "Learn with Nova," "Learn with Sage," etc. Each button shows the tutor character waving and a brief preview of what's next. No text labels needed for LOW_VERBAL learners, as the tutor character IS the label.

---

## Technical Implementation Notes

### Rendering Engine
The Stage should be built using a GPU-accelerated 2D rendering framework (Pixi.js for web, Flutter CustomPainter or Flame for mobile) layered inside the React/Flutter app shell. This allows smooth animations, particle effects, and dynamic scene composition without the jank of DOM manipulation. The Stage canvas is overlaid with accessible HTML/Flutter widgets for interactive elements (buttons, drag targets) to maintain screen reader compatibility.

### Tutor Character System
Tutor characters are rendered using Lottie animations (exported from After Effects/Bodymovin) for complex character sequences, and sprite-sheet animations for real-time reactive movements. Each tutor has an animation state machine: idle, speaking, pointing, celebrating, thinking, encouraging, transitioning. The state machine receives events from the session flow controller and the learner's interaction signals.

### Audio Engine
Text-to-speech uses a high-quality neural TTS engine (Google Cloud TTS, Amazon Polly, or ElevenLabs) with per-tutor voice profiles. Audio narration is pre-generated during content creation (not synthesized in real-time during the session) to eliminate latency. Short reactive phrases ("Great job!", "Try again!", "Let me show you") are pre-cached as audio assets per tutor. Background audio and sound effects use the Web Audio API (web) or audioplayers (Flutter) with real-time volume adjustment based on the sensory profile.

### Sensory Profile Integration
At session start, the rendering engine loads the learner's sensory_profile from the Brain context API. A SensoryAdapter middleware processes all rendering instructions through sensitivity filters before they reach the screen. This means content authors and the LLM do not need to think about sensory adaptation; they generate "standard" content, and the SensoryAdapter automatically adjusts colors, animation speeds, audio levels, and layout density.

### Content Format
LLM-generated lessons are structured not as text, but as a scene description format (JSON-based) that The Stage rendering engine interprets. Each lesson is a sequence of "beats" (the theatrical term is intentional). Each beat specifies: visual elements to place on The Stage (with position, size, animation), audio narration text (sent to TTS), interaction type (tap, drag, speak, match), correct/acceptable responses, tutor character state (idle, speaking, pointing at element X), and transition to next beat. This format allows the same lesson content to render differently based on functioning level and sensory profile without regenerating the LLM content.

### Performance
The Stage must maintain 60fps on mid-range devices (2020-era iPad, budget Android tablet). Asset loading is progressive (background loads first, then interactive elements, then character). Sessions pre-fetch the next 2-3 beats while the current beat is active. Total asset size per session target: under 5MB for standard sessions, under 2MB for LOW_VERBAL sessions (fewer elements).

---

## What This Is NOT

This interface is NOT a chatbot with pretty colors. It is NOT a text-based Q&A with emoji reactions. It is NOT a video player with quizzes between clips. It is NOT a gamified worksheet. It is a purpose-built, multi-sensory, character-driven, Brain-adaptive learning environment where the child SEES concepts come to life, HEARS a trusted tutor guide them, TOUCHES and manipulates learning objects, and EXPERIENCES success through immediate, joyful, multi-channel feedback. The chat paradigm is fundamentally wrong for neurodiverse children. The Stage paradigm is built for how they actually learn.
