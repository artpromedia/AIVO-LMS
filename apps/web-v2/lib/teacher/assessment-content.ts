/**
 * Teacher assessment content — the 8-section "Classroom insights" question bank.
 *
 * This is the single source of truth for the teacher assessment wizard: the
 * section order, every question, its input type, and (for choice questions)
 * the allowed options. The validator (lib/validators/teacher-assessment.ts)
 * builds its Zod schemas from this content, the wizard UI renders from it, and
 * the submit projection reads option LABELS from it so the assessment-svc
 * payload (system of record) stays human-readable.
 *
 * Copy uses the `{name}` token for the learner's first name; the UI replaces it
 * at render time. Server-side projection never needs the name, so it reads
 * values/labels directly.
 *
 * 54 questions total, distributed exactly as the reference summary shows:
 *   1 Learning engagement (8)   2 Attention & regulation (7)
 *   3 Communication style (6)   4 Task independence (6)
 *   5 Academic strengths (6)    6 Support strategies (10)
 *   7 Classroom context (5)     8 Final notes (6)
 */

export type TeacherAssessmentSectionId =
  | "learning_engagement"
  | "attention_regulation"
  | "communication_style"
  | "task_independence"
  | "academic_strengths"
  | "support_strategies"
  | "classroom_context"
  | "final_notes";

export type TAQuestionType = "single" | "multi" | "text";

export type TAOption = { value: string; label: string };

export type TAQuestion = {
  id: string;
  prompt: string;
  helper?: string;
  type: TAQuestionType;
  options?: TAOption[];
  placeholder?: string;
  /** Optional questions never block section/assessment "complete". */
  optional?: boolean;
};

export type TASection = {
  id: TeacherAssessmentSectionId;
  /** 1-based position in the wizard. */
  index: number;
  title: string;
  subtitle: string;
  questions: TAQuestion[];
};

const opt = (value: string, label: string): TAOption => ({ value, label });

export const TEACHER_ASSESSMENT_SECTIONS: TASection[] = [
  {
    id: "learning_engagement",
    index: 1,
    title: "Learning engagement",
    subtitle: "How {name} connects with learning in your classroom.",
    questions: [
      {
        id: "le_motivation",
        prompt: "What motivates {name} most in class?",
        type: "single",
        options: [
          opt("praise", "Praise & encouragement"),
          opt("rewards", "Earning points or rewards"),
          opt("choice", "Choice & autonomy"),
          opt("peers", "Working with peers"),
          opt("interest", "Topics of personal interest"),
          opt("hands_on", "Hands-on activities"),
        ],
      },
      {
        id: "le_interest_topics",
        prompt: "Which activities does {name} engage with most?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("reading", "Reading & stories"),
          opt("building", "Building & making"),
          opt("art", "Drawing & art"),
          opt("movement", "Movement & games"),
          opt("music", "Music & sound"),
          opt("numbers", "Numbers & puzzles"),
          opt("technology", "Technology & screens"),
          opt("science", "Science & nature"),
        ],
      },
      {
        id: "le_engagement_level",
        prompt: "How would you describe {name}'s typical engagement?",
        type: "single",
        options: [
          opt("consistent", "Consistently engaged"),
          opt("familiar", "Engaged with familiar tasks"),
          opt("bursts", "Engaged in short bursts"),
          opt("with_support", "Engages with support"),
          opt("rarely", "Rarely engages independently"),
        ],
      },
      {
        id: "le_group_pref",
        prompt: "Where does {name} engage best?",
        type: "single",
        options: [
          opt("one_on_one", "One-on-one"),
          opt("small_group", "Small group"),
          opt("whole_class", "Whole class"),
          opt("independent", "Independent work"),
          opt("varies", "Varies by activity"),
        ],
      },
      {
        id: "le_new_tasks",
        prompt: "How does {name} approach new or unfamiliar tasks?",
        type: "single",
        options: [
          opt("eager", "Dives in eagerly"),
          opt("watches", "Watches first, then tries"),
          opt("encouragement", "Needs encouragement to start"),
          opt("hesitant", "Hesitant or avoidant"),
          opt("step_by_step", "Needs step-by-step guidance"),
        ],
      },
      {
        id: "le_persistence",
        prompt: "When a task gets hard, {name} usually…",
        type: "single",
        options: [
          opt("keeps_trying", "Keeps trying independently"),
          opt("asks_help", "Tries, then asks for help"),
          opt("pauses", "Pauses and waits"),
          opt("frustrated", "Gets frustrated"),
          opt("disengages", "Disengages or shuts down"),
        ],
      },
      {
        id: "le_signs_engaged",
        prompt: "What does engagement look like for {name}?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("attention", "Eye contact & attention"),
          opt("questions", "Asking questions"),
          opt("volunteering", "Volunteering answers"),
          opt("on_task", "Staying on task"),
          opt("helping", "Helping peers"),
          opt("excitement", "Verbalizing excitement"),
          opt("completing", "Completing work"),
        ],
      },
      {
        id: "le_engagement_notes",
        prompt: "Anything else about how {name} engages?",
        type: "text",
        placeholder: "Optional — a moment, a pattern, a spark you've noticed.",
        optional: true,
      },
    ],
  },
  {
    id: "attention_regulation",
    index: 2,
    title: "Attention & regulation",
    subtitle: "How {name} focuses, manages feelings, and handles change.",
    questions: [
      {
        id: "ar_focus_duration",
        prompt: "How long can {name} typically stay focused on a task?",
        type: "single",
        options: [
          opt("20_plus", "20+ minutes"),
          opt("10_20", "10–20 minutes"),
          opt("5_10", "5–10 minutes"),
          opt("under_5", "Under 5 minutes"),
          opt("varies", "Varies widely"),
        ],
      },
      {
        id: "ar_distractions",
        prompt: "What tends to distract {name}?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("noise", "Noise"),
          opt("visual_clutter", "Visual clutter"),
          opt("peers", "Peers"),
          opt("movement", "Movement nearby"),
          opt("transitions", "Transitions"),
          opt("internal", "Internal thoughts"),
          opt("screens", "Screens"),
          opt("unstructured", "Unstructured time"),
        ],
      },
      {
        id: "ar_regulation",
        prompt: "How does {name} manage frustration or big feelings?",
        type: "single",
        options: [
          opt("self_well", "Self-regulates well"),
          opt("self_reminders", "Self-regulates with reminders"),
          opt("adult_support", "Needs adult support"),
          opt("calm_space", "Needs a calm-down space"),
          opt("significant", "Needs significant support"),
        ],
      },
      {
        id: "ar_calming",
        prompt: "What helps {name} calm or refocus?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("quiet_space", "A quiet space"),
          opt("movement_break", "Movement break"),
          opt("breathing", "Deep breathing"),
          opt("fidget", "Fidget tool"),
          opt("check_in", "Adult check-in"),
          opt("routine", "Predictable routine"),
          opt("reduced_demands", "Reduced demands"),
          opt("sensory", "Sensory input"),
        ],
      },
      {
        id: "ar_transitions",
        prompt: "How does {name} handle transitions?",
        type: "single",
        options: [
          opt("smooth", "Smoothly"),
          opt("warning", "With a warning"),
          opt("visual_schedule", "With a visual schedule"),
          opt("support", "With support"),
          opt("difficult", "Difficult — needs planning"),
        ],
      },
      {
        id: "ar_triggers",
        prompt: "What can dysregulate {name}?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("change", "Unexpected change"),
          opt("loud", "Loud environments"),
          opt("rushed", "Being rushed"),
          opt("difficult_work", "Difficult work"),
          opt("conflict", "Peer conflict"),
          opt("hunger_fatigue", "Hunger or fatigue"),
          opt("overload", "Sensory overload"),
          opt("none", "None observed"),
        ],
      },
      {
        id: "ar_regulation_notes",
        prompt: "Anything else about {name}'s attention or regulation?",
        type: "text",
        placeholder: "Optional — what calm and focus look like for this learner.",
        optional: true,
      },
    ],
  },
  {
    id: "communication_style",
    index: 3,
    title: "Communication style",
    subtitle: "How {name} communicates and interacts in the classroom.",
    questions: [
      {
        id: "cs_express",
        prompt: "How does {name} express ideas or thoughts?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("sentences", "Speaks in complete sentences"),
          opt("phrases", "Speaks in short phrases"),
          opt("gestures", "Uses gestures or body language"),
          opt("visuals", "Uses visuals or writing"),
          opt("prompting", "Needs prompting to express ideas"),
          opt("aac", "Uses an AAC device"),
          opt("other", "Other"),
        ],
      },
      {
        id: "cs_respond",
        prompt: "How does {name} respond to questions?",
        helper: "Choose the best description.",
        type: "single",
        options: [
          opt("independent", "Responds independently"),
          opt("occasional", "Responds with occasional prompting"),
          opt("frequent", "Needs frequent prompting"),
          opt("consistent", "Needs immediate, consistent support"),
        ],
      },
      {
        id: "cs_receptive",
        prompt: "How well does {name} follow verbal directions?",
        type: "single",
        options: [
          opt("multi_step", "Follows multi-step directions"),
          opt("one_two", "Follows 1–2 step directions"),
          opt("repeated", "Needs directions repeated"),
          opt("visuals", "Needs visuals with directions"),
          opt("hands_on", "Needs hands-on support"),
        ],
      },
      {
        id: "cs_social",
        prompt: "How does {name} interact socially with peers?",
        type: "single",
        options: [
          opt("initiates", "Initiates & sustains"),
          opt("invited", "Joins when invited"),
          opt("parallel", "Plays/works alongside"),
          opt("adults", "Prefers adults"),
          opt("support", "Needs support to connect"),
        ],
      },
      {
        id: "cs_preferred_mode",
        prompt: "Which communication supports help {name}?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("visuals", "Visuals & picture cues"),
          opt("written", "Written instructions"),
          opt("repetition", "Verbal repetition"),
          opt("modeling", "Modeling"),
          opt("wait_time", "Extra wait time"),
          opt("sentence_starters", "Sentence starters"),
          opt("gestures", "Gestures"),
        ],
      },
      {
        id: "cs_communication_notes",
        prompt: "Anything else about how {name} communicates?",
        type: "text",
        placeholder: "Optional — preferred words, signs, or ways to connect.",
        optional: true,
      },
    ],
  },
  {
    id: "task_independence",
    index: 4,
    title: "Task independence",
    subtitle: "How independently {name} starts, works, and follows through.",
    questions: [
      {
        id: "ti_start",
        prompt: "How independently does {name} start tasks?",
        type: "single",
        options: [
          opt("independent", "Starts independently"),
          opt("prompt", "Starts after a prompt"),
          opt("model", "Needs a model"),
          opt("step_by_step", "Needs step-by-step"),
          opt("hand_over_hand", "Needs hand-over-hand"),
        ],
      },
      {
        id: "ti_complete",
        prompt: "How independently does {name} complete tasks?",
        type: "single",
        options: [
          opt("independent", "Completes independently"),
          opt("check_ins", "Completes with check-ins"),
          opt("redirection", "Needs frequent redirection"),
          opt("constant", "Needs constant support"),
          opt("rarely", "Rarely completes independently"),
        ],
      },
      {
        id: "ti_organization",
        prompt: "How are {name}'s organization skills?",
        type: "single",
        options: [
          opt("well", "Well organized"),
          opt("systems", "Organized with systems"),
          opt("inconsistent", "Inconsistent"),
          opt("visual_supports", "Needs visual supports"),
          opt("full_support", "Needs full support"),
        ],
      },
      {
        id: "ti_help_seeking",
        prompt: "How does {name} ask for help?",
        type: "single",
        options: [
          opt("clearly", "Asks clearly when needed"),
          opt("prompting", "Asks with prompting"),
          opt("waits", "Waits to be noticed"),
          opt("rarely", "Rarely asks"),
          opt("frustration", "Shows frustration instead"),
        ],
      },
      {
        id: "ti_supports_used",
        prompt: "Which independence supports work for {name}?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("checklists", "Checklists"),
          opt("visual_schedules", "Visual schedules"),
          opt("timers", "Timers"),
          opt("chunked", "Chunked tasks"),
          opt("first_then", "First-then boards"),
          opt("models", "Models & examples"),
          opt("peer", "Peer support"),
        ],
      },
      {
        id: "ti_independence_notes",
        prompt: "Anything else about {name}'s independence?",
        type: "text",
        placeholder: "Optional — where {name} surprises you on their own.",
        optional: true,
      },
    ],
  },
  {
    id: "academic_strengths",
    index: 5,
    title: "Academic strengths",
    subtitle: "Where {name} shines and how they learn best.",
    questions: [
      {
        id: "as_strong_subjects",
        prompt: "Where does {name} show academic strength?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("reading", "Reading"),
          opt("writing", "Writing"),
          opt("math", "Math"),
          opt("science", "Science"),
          opt("social_studies", "Social studies"),
          opt("art", "Art"),
          opt("hands_on", "Hands-on"),
          opt("discussion", "Verbal discussion"),
        ],
      },
      {
        id: "as_reading",
        prompt: "How would you describe {name}'s reading?",
        type: "single",
        options: [
          opt("above", "Above grade level"),
          opt("on", "On grade level"),
          opt("approaching", "Approaching"),
          opt("below", "Below — building skills"),
          opt("emergent", "Pre-reading / emergent"),
        ],
      },
      {
        id: "as_math",
        prompt: "How would you describe {name}'s math?",
        type: "single",
        options: [
          opt("above", "Above grade level"),
          opt("on", "On grade level"),
          opt("approaching", "Approaching"),
          opt("below", "Below — building skills"),
          opt("foundational", "Foundational / emergent"),
        ],
      },
      {
        id: "as_learning_style",
        prompt: "How does {name} learn best?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("visual", "Seeing (visual)"),
          opt("auditory", "Hearing (auditory)"),
          opt("hands_on", "Doing (hands-on)"),
          opt("reading_writing", "Reading / writing"),
          opt("movement", "Movement"),
          opt("repetition", "Repetition"),
          opt("real_world", "Real-world examples"),
        ],
      },
      {
        id: "as_demonstrates",
        prompt: "How does {name} best show what they know?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("writing", "Writing"),
          opt("speaking", "Speaking"),
          opt("drawing", "Drawing"),
          opt("building", "Building"),
          opt("demonstrating", "Demonstrating"),
          opt("multiple_choice", "Multiple choice"),
          opt("scribe", "With a scribe"),
        ],
      },
      {
        id: "as_strengths_notes",
        prompt: "Describe a recent moment {name} succeeded.",
        type: "text",
        placeholder: "Optional — a win worth carrying into the brain-clone.",
        optional: true,
      },
    ],
  },
  {
    id: "support_strategies",
    index: 6,
    title: "Support strategies",
    subtitle: "What already works — and where to focus next.",
    questions: [
      {
        id: "ss_working_now",
        prompt: "Which supports are working now?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("visual_schedule", "Visual schedule"),
          opt("preferential_seating", "Preferential seating"),
          opt("movement_breaks", "Movement breaks"),
          opt("chunked", "Chunked assignments"),
          opt("extended_time", "Extended time"),
          opt("check_ins", "Check-ins"),
          opt("quiet_space", "Quiet space"),
          opt("reduced_workload", "Reduced workload"),
          opt("peer_buddy", "Peer buddy"),
          opt("first_then", "First-then"),
        ],
      },
      {
        id: "ss_accommodations",
        prompt: "Which accommodations does {name} use?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("extended_time", "Extended time"),
          opt("read_aloud", "Read-aloud"),
          opt("scribe", "Scribe"),
          opt("frequent_breaks", "Frequent breaks"),
          opt("reduced_items", "Reduced items"),
          opt("assistive_tech", "Assistive tech"),
          opt("preferential_seating", "Preferential seating"),
          opt("visual_aids", "Visual aids"),
          opt("modified", "Modified assignments"),
          opt("small_group_testing", "Small-group testing"),
        ],
      },
      {
        id: "ss_seating",
        prompt: "What seating works best?",
        type: "single",
        options: [
          opt("front", "Front & center"),
          opt("near_teacher", "Near teacher"),
          opt("away_distraction", "Away from doors/windows"),
          opt("flexible", "Flexible seating"),
          opt("standing", "Standing option"),
          opt("quiet_corner", "Quiet corner"),
        ],
      },
      {
        id: "ss_breaks",
        prompt: "How often does {name} need breaks?",
        type: "single",
        options: [
          opt("5_10", "Every 5–10 min"),
          opt("15_20", "Every 15–20 min"),
          opt("30", "Every 30 min"),
          opt("as_needed", "As needed"),
          opt("rarely", "Rarely"),
        ],
      },
      {
        id: "ss_motivators",
        prompt: "Which reinforcers motivate {name}?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("praise", "Praise"),
          opt("tokens", "Points / tokens"),
          opt("choice", "Choice time"),
          opt("preferred", "Preferred activity"),
          opt("movement", "Movement"),
          opt("sensory", "Sensory item"),
          opt("tech", "Tech time"),
          opt("helper", "Helper roles"),
        ],
      },
      {
        id: "ss_redirect",
        prompt: "What's the best way to redirect {name}?",
        type: "single",
        options: [
          opt("verbal", "Quiet verbal cue"),
          opt("visual", "Visual cue"),
          opt("proximity", "Proximity"),
          opt("private", "Private check-in"),
          opt("nonverbal", "Nonverbal signal"),
          opt("break", "Brief break"),
        ],
      },
      {
        id: "ss_instructions",
        prompt: "How should instructions be given to {name}?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("one_step", "One step at a time"),
          opt("visuals", "With visuals"),
          opt("written_verbal", "Written + verbal"),
          opt("modeled", "Modeled"),
          opt("repeated", "Repeated"),
          opt("wait_time", "With wait time"),
          opt("check_understanding", "Checked for understanding"),
        ],
      },
      {
        id: "ss_plan",
        prompt: "Which plan are these supports part of?",
        type: "single",
        options: [
          opt("iep", "IEP"),
          opt("504", "504 plan"),
          opt("mtss_rti", "MTSS / RTI"),
          opt("informal", "Informal classroom supports"),
          opt("none", "None yet"),
        ],
      },
      {
        id: "ss_focus_areas",
        prompt: "Where would you focus support next?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("reading", "Reading"),
          opt("writing", "Writing"),
          opt("math", "Math"),
          opt("attention", "Attention"),
          opt("regulation", "Self-regulation"),
          opt("communication", "Communication"),
          opt("social", "Social skills"),
          opt("independence", "Independence"),
          opt("organization", "Organization"),
        ],
      },
      {
        id: "ss_support_notes",
        prompt: "Anything else about supports for {name}?",
        type: "text",
        placeholder: "Optional — what to keep, change, or try next.",
        optional: true,
      },
    ],
  },
  {
    id: "classroom_context",
    index: 7,
    title: "Classroom context",
    subtitle: "Your setting and relationship with {name}.",
    questions: [
      {
        id: "cc_grade",
        prompt: "What grade band is {name} in?",
        type: "single",
        options: [
          opt("preK", "Pre-K"),
          opt("K", "Kindergarten"),
          opt("1-2", "1st–2nd"),
          opt("3-5", "3rd–5th"),
          opt("6-8", "6th–8th"),
          opt("9-12", "9th–12th"),
        ],
      },
      {
        id: "cc_setting",
        prompt: "What is {name}'s primary setting?",
        type: "single",
        options: [
          opt("general_ed", "General education"),
          opt("co_taught", "Co-taught"),
          opt("resource", "Resource room"),
          opt("self_contained", "Self-contained"),
          opt("specialized", "Specialized program"),
        ],
      },
      {
        id: "cc_subject",
        prompt: "Which subjects do you teach {name}?",
        helper: "Select all that apply.",
        type: "multi",
        options: [
          opt("reading", "Reading / ELA"),
          opt("math", "Math"),
          opt("science", "Science"),
          opt("social_studies", "Social studies"),
          opt("specials", "Specials"),
          opt("all", "All subjects"),
        ],
      },
      {
        id: "cc_relationship",
        prompt: "How long have you worked with {name}?",
        type: "single",
        options: [
          opt("under_month", "Less than a month"),
          opt("1_3_months", "1–3 months"),
          opt("semester", "This semester"),
          opt("year", "This year"),
          opt("more_year", "More than a year"),
        ],
      },
      {
        id: "cc_role",
        prompt: "What is your role with {name}?",
        type: "single",
        options: [
          opt("general_ed", "General Ed Teacher"),
          opt("special_ed", "Special Ed Teacher"),
          opt("intervention", "Intervention Specialist"),
          opt("subject_specialist", "Subject Specialist"),
          opt("paraeducator", "Paraeducator"),
          opt("related_service", "Related Service Provider"),
        ],
      },
    ],
  },
  {
    id: "final_notes",
    index: 8,
    title: "Final notes",
    subtitle: "The whole-child context that numbers miss.",
    questions: [
      {
        id: "fn_celebrate",
        prompt: "What's one thing to celebrate about {name}?",
        type: "text",
        placeholder: "A strength, a moment, something that makes {name} light up.",
        optional: true,
      },
      {
        id: "fn_concerns",
        prompt: "Any areas of concern to flag?",
        helper: "Select all that apply.",
        type: "multi",
        optional: true,
        options: [
          opt("attendance", "Attendance"),
          opt("academic_gaps", "Academic gaps"),
          opt("social_emotional", "Social-emotional"),
          opt("attention", "Attention"),
          opt("behavior", "Behavior"),
          opt("communication", "Communication"),
          opt("motor", "Motor skills"),
          opt("none", "None at this time"),
        ],
      },
      {
        id: "fn_family",
        prompt: "How is home–school communication?",
        type: "single",
        optional: true,
        options: [
          opt("strong", "Strong & frequent"),
          opt("occasional", "Occasional"),
          opt("limited", "Limited"),
          opt("starting", "Just starting"),
          opt("none", "Not established"),
        ],
      },
      {
        id: "fn_goals",
        prompt: "What goals would you prioritize for {name}?",
        type: "text",
        placeholder: "Optional — the next one or two things that matter most.",
        optional: true,
      },
      {
        id: "fn_anything",
        prompt: "Anything else AIVO should know about {name}?",
        type: "text",
        placeholder: "Optional — context that helps us build the right support.",
        optional: true,
      },
      {
        id: "fn_confidence",
        prompt: "How confident are you in these responses?",
        type: "single",
        options: [
          opt("very", "Very confident"),
          opt("confident", "Confident"),
          opt("somewhat", "Somewhat"),
          opt("getting_to_know", "Still getting to know {name}"),
        ],
      },
    ],
  },
];

/** Canonical persistence order of the eight sections. */
export const TEACHER_ASSESSMENT_SECTION_ORDER: TeacherAssessmentSectionId[] =
  TEACHER_ASSESSMENT_SECTIONS.map((s) => s.id);

export const TEACHER_ASSESSMENT_TOTAL_QUESTIONS = TEACHER_ASSESSMENT_SECTIONS.reduce(
  (n, s) => n + s.questions.length,
  0,
);

const SECTION_BY_ID = new Map(TEACHER_ASSESSMENT_SECTIONS.map((s) => [s.id, s]));

export function getSection(id: TeacherAssessmentSectionId): TASection | undefined {
  return SECTION_BY_ID.get(id);
}

export function getQuestion(
  id: TeacherAssessmentSectionId,
  questionId: string,
): TAQuestion | undefined {
  return getSection(id)?.questions.find((q) => q.id === questionId);
}

/** Number of questions that must be answered for a section to be "complete". */
export function requiredQuestionCount(id: TeacherAssessmentSectionId): number {
  return getSection(id)?.questions.filter((q) => !q.optional).length ?? 0;
}

/** Map a stored option value to its human-readable label (for projection/UI). */
export function optionLabel(
  id: TeacherAssessmentSectionId,
  questionId: string,
  value: string,
): string {
  const q = getQuestion(id, questionId);
  return q?.options?.find((o) => o.value === value)?.label ?? value;
}

/** Replace the `{name}` token with the learner's first name. */
export function withName(text: string, name: string): string {
  return text.replace(/\{name\}/g, name);
}
